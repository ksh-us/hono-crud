import type { Context, MiddlewareHandler } from 'hono';
import type { AuthEnv, JWTConfig, JWTClaims, JWTAlgorithm, AuthUser } from '../types.js';
import { UnauthorizedException } from '../../core/exceptions.js';
import { validateJWTClaims } from '../validators/jwt-claims.js';

// ============================================================================
// JWT Utilities
// ============================================================================

/**
 * Base64url decode a string.
 */
function base64urlDecode(str: string): Uint8Array {
  // Add padding if needed
  const padded = str + '==='.slice(0, (4 - (str.length % 4)) % 4);
  // Replace base64url chars with base64 chars
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  // Decode
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ============================================================================
// Algorithm Configuration
// ============================================================================

/**
 * Algorithm configuration for Web Crypto API.
 */
interface AlgorithmConfig {
  name: string;
  hash: string;
  namedCurve?: string;
}

/**
 * Map of JWT algorithms to their Web Crypto configurations.
 * O(1) lookup instead of switch statement.
 */
const JWT_ALGORITHM_CONFIG: ReadonlyMap<JWTAlgorithm, AlgorithmConfig> = new Map([
  ['HS256', { name: 'HMAC', hash: 'SHA-256' }],
  ['HS384', { name: 'HMAC', hash: 'SHA-384' }],
  ['HS512', { name: 'HMAC', hash: 'SHA-512' }],
  ['RS256', { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }],
  ['RS384', { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-384' }],
  ['RS512', { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' }],
  ['ES256', { name: 'ECDSA', hash: 'SHA-256', namedCurve: 'P-256' }],
  ['ES384', { name: 'ECDSA', hash: 'SHA-384', namedCurve: 'P-384' }],
  ['ES512', { name: 'ECDSA', hash: 'SHA-512', namedCurve: 'P-521' }],
]);

/**
 * Get the Web Crypto algorithm configuration for a JWT algorithm.
 */
function getAlgorithmConfig(algorithm: JWTAlgorithm): AlgorithmConfig {
  const config = JWT_ALGORITHM_CONFIG.get(algorithm);
  if (!config) {
    throw new Error(`Unsupported algorithm: ${algorithm}`);
  }
  return config;
}

/**
 * Import a key for JWT verification.
 */
async function importKey(
  secret: string | CryptoKey,
  algorithm: JWTAlgorithm
): Promise<CryptoKey> {
  if (secret instanceof CryptoKey) {
    return secret;
  }

  const config = getAlgorithmConfig(algorithm);

  if (config.name === 'HMAC') {
    // For HMAC, import the secret as a symmetric key
    const encoder = new TextEncoder();
    return crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: config.hash! },
      false,
      ['verify']
    );
  }

  // For RSA/ECDSA, the secret should be a PEM-encoded public key
  // Parse PEM and import as SPKI
  const pemHeader = '-----BEGIN PUBLIC KEY-----';
  const pemFooter = '-----END PUBLIC KEY-----';

  if (!secret.includes(pemHeader)) {
    throw new Error('RSA/ECDSA algorithms require a PEM-encoded public key');
  }

  const pemContents = secret
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');

  const binaryKey = base64urlDecode(
    pemContents.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  );

  const importConfig: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams =
    config.namedCurve
      ? { name: config.name, namedCurve: config.namedCurve }
      : { name: config.name, hash: config.hash! };

  return crypto.subtle.importKey('spki', binaryKey.buffer as ArrayBuffer, importConfig, false, ['verify']);
}

/**
 * Verify a JWT signature.
 */
async function verifySignature(
  token: string,
  key: CryptoKey,
  algorithm: JWTAlgorithm
): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }

  const [header, payload, signature] = parts;
  const signedContent = `${header}.${payload}`;

  const encoder = new TextEncoder();
  const data = encoder.encode(signedContent);
  const sig = base64urlDecode(signature);

  const config = getAlgorithmConfig(algorithm);

  let verifyConfig: AlgorithmIdentifier | RsaPssParams | EcdsaParams;
  if (config.name === 'ECDSA') {
    verifyConfig = { name: 'ECDSA', hash: config.hash! };
  } else {
    verifyConfig = { name: config.name };
  }

  try {
    return await crypto.subtle.verify(verifyConfig, key, sig.buffer as ArrayBuffer, data.buffer as ArrayBuffer);
  } catch {
    return false;
  }
}

/**
 * Decode JWT payload without verification.
 */
function decodePayload(token: string): JWTClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload = base64urlDecode(parts[1]);
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(payload));
  } catch {
    return null;
  }
}

/**
 * Decode JWT header.
 */
function decodeHeader(token: string): { alg?: string; typ?: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const header = base64urlDecode(parts[0]);
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(header));
  } catch {
    return null;
  }
}

/**
 * Default function to extract the token from the request.
 */
function defaultExtractToken(ctx: Context): string | null {
  const authHeader = ctx.req.header('Authorization');
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Default function to extract user info from JWT claims.
 */
function defaultExtractUser(claims: JWTClaims): AuthUser {
  return {
    id: String(claims.sub || claims.id || ''),
    email: claims.email as string | undefined,
    roles: (claims.roles || claims.role) as string[] | undefined,
    permissions: claims.permissions as string[] | undefined,
    metadata: claims.metadata as Record<string, unknown> | undefined,
  };
}

// ============================================================================
// JWT Middleware
// ============================================================================

/**
 * Creates JWT authentication middleware.
 *
 * @example
 * ```ts
 * const app = new Hono<AuthEnv>();
 *
 * app.use('*', createJWTMiddleware({
 *   secret: process.env.JWT_SECRET!,
 *   issuer: 'my-app',
 * }));
 *
 * app.get('/me', (c) => {
 *   return c.json({ userId: c.var.userId });
 * });
 * ```
 */
export function createJWTMiddleware<E extends AuthEnv = AuthEnv>(
  config: JWTConfig
): MiddlewareHandler<E> {
  const algorithm = config.algorithm || 'HS256';
  const clockTolerance = config.clockTolerance || 0;
  const extractToken = config.extractToken || defaultExtractToken;
  const extractUser = config.extractUser || defaultExtractUser;

  // Cache the imported key
  let cachedKey: CryptoKey | null = null;

  return async (ctx, next) => {
    // Extract token
    const token = extractToken(ctx as unknown as Context);
    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    // Verify header algorithm matches expected
    const header = decodeHeader(token);
    if (!header || header.alg !== algorithm) {
      throw new UnauthorizedException('Invalid token algorithm');
    }

    // Import key if not cached
    if (!cachedKey) {
      cachedKey = await importKey(config.secret, algorithm);
    }

    // Verify signature
    const isValid = await verifySignature(token, cachedKey, algorithm);
    if (!isValid) {
      throw new UnauthorizedException('Invalid token signature');
    }

    // Decode and validate claims
    const claims = decodePayload(token);
    if (!claims) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Validate claims using shared validator
    validateJWTClaims(claims, {
      clockTolerance,
      issuer: config.issuer,
      audience: config.audience,
    });

    // Extract user info
    const user = extractUser(claims);

    // Set context variables
    ctx.set('userId', user.id);
    ctx.set('user', user);
    ctx.set('roles', user.roles || []);
    ctx.set('permissions', user.permissions || []);
    ctx.set('authType', 'jwt');

    await next();
  };
}

/**
 * Verifies a JWT token and returns the claims.
 * Useful for manual token verification outside of middleware.
 *
 * @param token - The JWT token to verify
 * @param config - JWT configuration
 * @returns The decoded claims if valid
 * @throws UnauthorizedException if the token is invalid
 */
export async function verifyJWT(
  token: string,
  config: JWTConfig
): Promise<JWTClaims> {
  const algorithm = config.algorithm || 'HS256';
  const clockTolerance = config.clockTolerance || 0;

  // Verify header algorithm matches expected
  const header = decodeHeader(token);
  if (!header || header.alg !== algorithm) {
    throw new UnauthorizedException('Invalid token algorithm');
  }

  // Import key
  const key = await importKey(config.secret, algorithm);

  // Verify signature
  const isValid = await verifySignature(token, key, algorithm);
  if (!isValid) {
    throw new UnauthorizedException('Invalid token signature');
  }

  // Decode and validate claims
  const claims = decodePayload(token);
  if (!claims) {
    throw new UnauthorizedException('Invalid token payload');
  }

  // Validate claims using shared validator
  validateJWTClaims(claims, {
    clockTolerance,
    issuer: config.issuer,
    audience: config.audience,
  });

  return claims;
}

/**
 * Decodes a JWT token without verification.
 * WARNING: This does not verify the signature. Use only for debugging or
 * when you know the token has already been verified.
 */
export function decodeJWT(token: string): { header: unknown; payload: JWTClaims } | null {
  const header = decodeHeader(token);
  const payload = decodePayload(token);

  if (!header || !payload) {
    return null;
  }

  return { header, payload };
}
