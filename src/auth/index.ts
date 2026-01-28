// ============================================================================
// Type Exports
// ============================================================================

export type {
  // User types
  AuthUser,
  AuthType,
  AuthEnv,
  // JWT types
  JWTAlgorithm,
  JWTClaims,
  JWTConfig,
  ValidatedJWTClaims,
  // API Key types
  APIKeyEntry,
  APIKeyLookupResult,
  APIKeyConfig,
  // Auth config types
  PathPattern,
  AuthConfig,
  // Guard types
  AuthorizationCheck,
  OwnershipExtractor,
  Guard,
  // Endpoint types
  EndpointAuthConfig,
} from './types.js';

export {
  // JWT claims validation
  JWTClaimsSchema,
  parseJWTClaims,
  safeParseJWTClaims,
} from './types.js';

// ============================================================================
// Middleware Exports
// ============================================================================

// JWT middleware
export { createJWTMiddleware, verifyJWT, decodeJWT } from './middleware/jwt.js';

// API Key middleware
export {
  createAPIKeyMiddleware,
  validateAPIKey,
  defaultHashAPIKey,
} from './middleware/api-key.js';

// Combined middleware
export {
  createAuthMiddleware,
  optionalAuth,
  requireAuthentication,
} from './middleware/combined.js';

// ============================================================================
// Guard Exports
// ============================================================================

export {
  // Role guards
  requireRoles,
  requireAllRoles,
  // Permission guards
  requirePermissions,
  requireAnyPermission,
  // Custom guards
  requireAuth,
  requireOwnership,
  requireOwnershipOrRole,
  // Guard composition
  allOf,
  anyOf,
  // Utility guards
  denyAll,
  allowAll,
  requireAuthenticated,
} from './guards.js';

// ============================================================================
// Endpoint Exports
// ============================================================================

export { AuthenticatedEndpoint, withAuth } from './endpoint.js';
export type { AuthEndpointMethods } from './endpoint.js';

// ============================================================================
// Storage Exports
// ============================================================================

export {
  MemoryAPIKeyStorage,
  generateAPIKey,
  hashAPIKey,
  isValidAPIKeyFormat,
  getAPIKeyStorage,
  setAPIKeyStorage,
} from './storage/memory.js';

// ============================================================================
// Validator Exports
// ============================================================================

export { validateJWTClaims } from './validators/jwt-claims.js';
export type { JWTClaimsValidationOptions } from './validators/jwt-claims.js';

export { validateAPIKeyEntry } from './validators/api-key.js';
