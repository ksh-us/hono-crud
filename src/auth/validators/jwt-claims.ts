import type { JWTClaims } from '../types.js';
import { UnauthorizedException } from '../../core/exceptions.js';

/**
 * Options for JWT claims validation.
 */
export interface JWTClaimsValidationOptions {
  /**
   * Clock tolerance in seconds for exp/nbf validation.
   * @default 0
   */
  clockTolerance?: number;

  /**
   * Expected issuer claim (iss).
   * If provided, tokens with different issuers are rejected.
   */
  issuer?: string;

  /**
   * Expected audience claim (aud).
   * If provided, tokens must include this audience.
   */
  audience?: string | string[];
}

/**
 * Validates JWT claims including expiration, not-before, issuer, and audience.
 * This is extracted as a shared validator to eliminate duplication between
 * createJWTMiddleware and verifyJWT functions.
 *
 * @param claims - The decoded JWT claims to validate
 * @param options - Validation options
 * @throws UnauthorizedException if validation fails
 *
 * @example
 * ```ts
 * const claims = decodePayload(token);
 * if (!claims) {
 *   throw new UnauthorizedException('Invalid token payload');
 * }
 *
 * validateJWTClaims(claims, {
 *   clockTolerance: 60,
 *   issuer: 'my-app',
 *   audience: 'my-audience',
 * });
 * ```
 */
export function validateJWTClaims(
  claims: JWTClaims,
  options: JWTClaimsValidationOptions = {}
): void {
  const { clockTolerance = 0, issuer, audience } = options;
  const now = Math.floor(Date.now() / 1000);

  // Check expiration
  if (claims.exp !== undefined) {
    if (now > claims.exp + clockTolerance) {
      throw new UnauthorizedException('Token has expired');
    }
  }

  // Check not before
  if (claims.nbf !== undefined) {
    if (now < claims.nbf - clockTolerance) {
      throw new UnauthorizedException('Token not yet valid');
    }
  }

  // Check issuer
  if (issuer !== undefined) {
    if (claims.iss !== issuer) {
      throw new UnauthorizedException('Invalid token issuer');
    }
  }

  // Check audience
  if (audience !== undefined) {
    const expectedAud = Array.isArray(audience) ? audience : [audience];
    const tokenAud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];

    const hasValidAud = expectedAud.some((aud) => tokenAud.includes(aud));
    if (!hasValidAud) {
      throw new UnauthorizedException('Invalid token audience');
    }
  }
}
