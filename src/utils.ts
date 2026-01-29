import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from 'hono';
import type { OpenAPIRoute } from './core/route';

/**
 * Type for an OpenAPIRoute class constructor.
 * This represents a class that can be instantiated to create a route handler.
 */
export interface EndpointClass<E extends Env = Env> {
  new (): OpenAPIRoute<E>;
  isRoute?: boolean;
}

/**
 * CRUD endpoint configuration for registerCrud helper.
 * Accepts any class that extends OpenAPIRoute.
 */
export interface CrudEndpoints<E extends Env = Env> {
  create?: EndpointClass<E>;
  list?: EndpointClass<E>;
  read?: EndpointClass<E>;
  update?: EndpointClass<E>;
  delete?: EndpointClass<E>;
  /** Restore endpoint for un-deleting soft-deleted records */
  restore?: EndpointClass<E>;
  /** Batch create endpoint */
  batchCreate?: EndpointClass<E>;
  /** Batch update endpoint */
  batchUpdate?: EndpointClass<E>;
  /** Batch delete endpoint */
  batchDelete?: EndpointClass<E>;
  /** Batch restore endpoint for un-deleting multiple soft-deleted records */
  batchRestore?: EndpointClass<E>;
  /** Search endpoint for full-text search with relevance scoring */
  search?: EndpointClass<E>;
  /** Aggregate endpoint for computing aggregations */
  aggregate?: EndpointClass<E>;
  /** Export endpoint for bulk data export in CSV/JSON formats */
  export?: EndpointClass<E>;
  /** Import endpoint for bulk data import from CSV/JSON */
  import?: EndpointClass<E>;
}

/**
 * Type for the proxied app returned by fromHono.
 * Extends OpenAPIHono to accept both regular handlers and endpoint classes.
 */
export type HonoOpenAPIApp<E extends Env = Env> = OpenAPIHono<E> & {
  /**
   * Register a GET endpoint with an OpenAPIRoute class
   */
  get(path: string, handler: EndpointClass<E>): HonoOpenAPIApp<E>;
  /**
   * Register a POST endpoint with an OpenAPIRoute class
   */
  post(path: string, handler: EndpointClass<E>): HonoOpenAPIApp<E>;
  /**
   * Register a PUT endpoint with an OpenAPIRoute class
   */
  put(path: string, handler: EndpointClass<E>): HonoOpenAPIApp<E>;
  /**
   * Register a PATCH endpoint with an OpenAPIRoute class
   */
  patch(path: string, handler: EndpointClass<E>): HonoOpenAPIApp<E>;
  /**
   * Register a DELETE endpoint with an OpenAPIRoute class
   */
  delete(path: string, handler: EndpointClass<E>): HonoOpenAPIApp<E>;
};

/**
 * Registers CRUD endpoints for a resource.
 *
 * @example
 * ```ts
 * registerCrud(app, '/users', {
 *   create: UserCreate,
 *   list: UserList,
 *   read: UserRead,
 *   update: UserUpdate,
 *   delete: UserDelete,
 * });
 * ```
 */
export function registerCrud<E extends Env = Env>(
  app: HonoOpenAPIApp<E> | OpenAPIHono<E>,
  basePath: string,
  endpoints: CrudEndpoints<E>
): void {
  const normalizedPath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  const typedApp = app as HonoOpenAPIApp<E>;

  // Collection-level routes (no :id parameter)
  if (endpoints.create) {
    typedApp.post(normalizedPath, endpoints.create);
  }

  if (endpoints.list) {
    typedApp.get(normalizedPath, endpoints.list);
  }

  // IMPORTANT: Batch routes must be registered BEFORE :id routes
  // to prevent /batch from being matched as an id parameter
  if (endpoints.batchCreate) {
    typedApp.post(`${normalizedPath}/batch`, endpoints.batchCreate);
  }

  if (endpoints.batchUpdate) {
    typedApp.patch(`${normalizedPath}/batch`, endpoints.batchUpdate);
  }

  if (endpoints.batchDelete) {
    typedApp.delete(`${normalizedPath}/batch`, endpoints.batchDelete);
  }

  if (endpoints.batchRestore) {
    typedApp.post(`${normalizedPath}/batch/restore`, endpoints.batchRestore);
  }

  // Search endpoint - must be registered BEFORE :id routes
  if (endpoints.search) {
    typedApp.get(`${normalizedPath}/search`, endpoints.search);
  }

  // Aggregate endpoint - must be registered BEFORE :id routes
  if (endpoints.aggregate) {
    typedApp.get(`${normalizedPath}/aggregate`, endpoints.aggregate);
  }

  // Export endpoint - must be registered BEFORE :id routes
  if (endpoints.export) {
    typedApp.get(`${normalizedPath}/export`, endpoints.export);
  }

  // Import endpoint - must be registered BEFORE :id routes
  if (endpoints.import) {
    typedApp.post(`${normalizedPath}/import`, endpoints.import);
  }

  // Item-level routes (with :id parameter) - must be registered AFTER /batch, /search, /export, /import routes
  if (endpoints.read) {
    typedApp.get(`${normalizedPath}/:id`, endpoints.read);
  }

  if (endpoints.update) {
    typedApp.patch(`${normalizedPath}/:id`, endpoints.update);
  }

  if (endpoints.delete) {
    typedApp.delete(`${normalizedPath}/:id`, endpoints.delete);
  }

  if (endpoints.restore) {
    typedApp.post(`${normalizedPath}/:id/restore`, endpoints.restore);
  }
}

/**
 * Creates a JSON content type helper for OpenAPI schemas.
 */
export function contentJson<T>(schema: T) {
  return {
    content: {
      'application/json': {
        schema,
      },
    },
  };
}

/**
 * Creates a standardized success response schema.
 */
export function successResponse<T>(schema: T) {
  return {
    description: 'Success',
    ...contentJson({
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const, enum: [true] },
        result: schema,
      },
      required: ['success', 'result'],
    }),
  };
}

/**
 * Creates a standardized error response schema.
 */
export function errorResponse(description: string = 'Error') {
  return {
    description,
    ...contentJson({
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const, enum: [false] },
        error: {
          type: 'object' as const,
          properties: {
            code: { type: 'string' as const },
            message: { type: 'string' as const },
            details: {},
          },
          required: ['code', 'message'],
        },
      },
      required: ['success', 'error'],
    }),
  };
}
