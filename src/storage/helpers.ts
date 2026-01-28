import type { Context, Env } from 'hono';
import type { RateLimitStorage } from '../rate-limit/types.js';
import type { LoggingStorage } from '../logging/types.js';
import type { CacheStorage } from '../cache/types.js';
import type { AuditLogStorage } from '../core/audit.js';
import type { VersioningStorage } from '../core/versioning.js';
import type { MemoryAPIKeyStorage } from '../auth/storage/memory.js';
import { getRateLimitStorage } from '../rate-limit/middleware.js';
import { getLoggingStorage } from '../logging/middleware.js';
import { getCacheStorage } from '../cache/mixin.js';
import { getAuditStorage } from '../core/audit.js';
import { getVersioningStorage } from '../core/versioning.js';
import { getAPIKeyStorage } from '../auth/storage/memory.js';

/**
 * Helper to safely access context variables.
 * Uses type assertion through unknown to handle generic Env types.
 */
function getContextVar<T>(ctx: unknown, key: string): T | undefined {
  // Access via .var property and cast through unknown for type safety
  const ctxObj = ctx as { var?: Record<string, unknown> };
  return ctxObj?.var?.[key] as T | undefined;
}

/**
 * Resolves rate limit storage with priority: explicit param > context > global.
 *
 * @param ctx - Optional Hono context
 * @param explicitStorage - Optional explicit storage instance
 * @returns The resolved storage or null if none available
 *
 * @example
 * ```ts
 * // In middleware
 * const storage = resolveRateLimitStorage(ctx, config.storage);
 * if (!storage) {
 *   console.warn('No rate limit storage configured');
 *   return next();
 * }
 * ```
 */
export function resolveRateLimitStorage<E extends Env>(
  ctx?: Context<E>,
  explicitStorage?: RateLimitStorage
): RateLimitStorage | null {
  // Priority 1: Explicit parameter
  if (explicitStorage) return explicitStorage;

  // Priority 2: Context variable
  if (ctx) {
    const ctxStorage = getContextVar<RateLimitStorage>(ctx, 'rateLimitStorage');
    if (ctxStorage) return ctxStorage;
  }

  // Priority 3: Global storage
  return getRateLimitStorage();
}

/**
 * Resolves logging storage with priority: explicit param > context > global.
 *
 * @param ctx - Optional Hono context
 * @param explicitStorage - Optional explicit storage instance
 * @returns The resolved storage or null if none available
 */
export function resolveLoggingStorage<E extends Env>(
  ctx?: Context<E>,
  explicitStorage?: LoggingStorage
): LoggingStorage | null {
  // Priority 1: Explicit parameter
  if (explicitStorage) return explicitStorage;

  // Priority 2: Context variable
  if (ctx) {
    const ctxStorage = getContextVar<LoggingStorage>(ctx, 'loggingStorage');
    if (ctxStorage) return ctxStorage;
  }

  // Priority 3: Global storage
  return getLoggingStorage();
}

/**
 * Resolves cache storage with priority: explicit param > context > global.
 *
 * @param ctx - Optional Hono context
 * @param explicitStorage - Optional explicit storage instance
 * @returns The resolved storage (defaults to global MemoryCacheStorage)
 */
export function resolveCacheStorage<E extends Env>(
  ctx?: Context<E>,
  explicitStorage?: CacheStorage
): CacheStorage {
  // Priority 1: Explicit parameter
  if (explicitStorage) return explicitStorage;

  // Priority 2: Context variable
  if (ctx) {
    const ctxStorage = getContextVar<CacheStorage>(ctx, 'cacheStorage');
    if (ctxStorage) return ctxStorage;
  }

  // Priority 3: Global storage (always returns a default)
  return getCacheStorage();
}

/**
 * Resolves audit storage with priority: explicit param > context > global.
 *
 * @param ctx - Optional Hono context
 * @param explicitStorage - Optional explicit storage instance
 * @returns The resolved storage (defaults to global MemoryAuditLogStorage)
 */
export function resolveAuditStorage<E extends Env>(
  ctx?: Context<E>,
  explicitStorage?: AuditLogStorage
): AuditLogStorage {
  // Priority 1: Explicit parameter
  if (explicitStorage) return explicitStorage;

  // Priority 2: Context variable
  if (ctx) {
    const ctxStorage = getContextVar<AuditLogStorage>(ctx, 'auditStorage');
    if (ctxStorage) return ctxStorage;
  }

  // Priority 3: Global storage (always returns a default)
  return getAuditStorage();
}

/**
 * Resolves versioning storage with priority: explicit param > context > global.
 *
 * @param ctx - Optional Hono context
 * @param explicitStorage - Optional explicit storage instance
 * @returns The resolved storage (defaults to global MemoryVersioningStorage)
 */
export function resolveVersioningStorage<E extends Env>(
  ctx?: Context<E>,
  explicitStorage?: VersioningStorage
): VersioningStorage {
  // Priority 1: Explicit parameter
  if (explicitStorage) return explicitStorage;

  // Priority 2: Context variable
  if (ctx) {
    const ctxStorage = getContextVar<VersioningStorage>(ctx, 'versioningStorage');
    if (ctxStorage) return ctxStorage;
  }

  // Priority 3: Global storage (always returns a default)
  return getVersioningStorage();
}

/**
 * Resolves API key storage with priority: explicit param > context > global.
 *
 * @param ctx - Optional Hono context
 * @param explicitStorage - Optional explicit storage instance
 * @returns The resolved storage (defaults to global MemoryAPIKeyStorage)
 */
export function resolveAPIKeyStorage<E extends Env>(
  ctx?: Context<E>,
  explicitStorage?: MemoryAPIKeyStorage
): MemoryAPIKeyStorage {
  // Priority 1: Explicit parameter
  if (explicitStorage) return explicitStorage;

  // Priority 2: Context variable
  if (ctx) {
    const ctxStorage = getContextVar<MemoryAPIKeyStorage>(ctx, 'apiKeyStorage');
    if (ctxStorage) return ctxStorage;
  }

  // Priority 3: Global storage (always returns a default)
  return getAPIKeyStorage();
}
