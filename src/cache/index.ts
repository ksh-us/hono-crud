// Types
export type {
  CacheEntry,
  CacheConfig,
  CacheSetOptions,
  CacheStorage,
  CacheStats,
  InvalidationStrategy,
  CacheInvalidationConfig,
  CacheKeyOptions,
  InvalidationPatternOptions,
} from './types.js';

// Key generation utilities
export {
  generateCacheKey,
  createInvalidationPattern,
  createRelatedPatterns,
  matchesPattern,
  parseCacheKey,
} from './key-generator.js';

// Storage implementations
export { MemoryCacheStorage } from './storage/memory.js';
export { RedisCacheStorage } from './storage/redis.js';
export type { RedisClient, RedisCacheStorageOptions } from './storage/redis.js';

// Mixins and global storage
export {
  withCache,
  withCacheInvalidation,
  setCacheStorage,
  getCacheStorage,
} from './mixin.js';
export type { CacheEndpointMethods, CacheInvalidationMethods } from './mixin.js';
