// Types
export type {
  LogLevel,
  RequestLogEntry,
  ResponseLogEntry,
  LogEntry,
  LogQueryOptions,
  LoggingStorage,
  PathPattern,
  RedactField,
  RequestBodyConfig,
  ResponseBodyConfig,
  LoggingConfig,
  LoggingEnv,
} from './types.js';

// Utilities
export {
  shouldRedact,
  redactObject,
  redactHeaders,
  matchPath,
  shouldExcludePath,
  extractClientIp,
  extractHeaders,
  extractQuery,
  extractUserId,
  truncateBody,
  isAllowedContentType,
  generateRequestId,
} from './utils.js';

// Middleware
export {
  createLoggingMiddleware,
  setLoggingStorage,
  getLoggingStorage,
  getRequestId,
  getRequestStartTime,
} from './middleware.js';

// Storage implementations
export { MemoryLoggingStorage } from './storage/memory.js';
export type { MemoryLoggingStorageOptions } from './storage/memory.js';
