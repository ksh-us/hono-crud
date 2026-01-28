import { Hono, type Env } from 'hono';
import { serve } from '@hono/node-server';
import { z } from 'zod';
import { fromHono, registerCrud, setupSwaggerUI, setupReDoc, defineModel, defineMeta } from '../src/index.js';
import {
  MemoryCreateEndpoint,
  MemoryReadEndpoint,
  MemoryUpdateEndpoint,
  MemoryDeleteEndpoint,
  MemoryListEndpoint,
  clearStorage,
} from '../src/adapters/memory/index.js';

// Clear storage on start
clearStorage();

// Define the User schema
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['admin', 'user']),
  createdAt: z.string().datetime().optional(),
});

type User = z.infer<typeof UserSchema>;

// Define the User model using the type-safe helper
const UserModel = defineModel({
  tableName: 'users',
  schema: UserSchema,
  primaryKeys: ['id'],  // Type-checked: must be keys of UserSchema
  serializer: (user) => {
    // Remove sensitive fields if needed
    return user;
  },
});

// Meta configuration using the type-safe helper
const userMeta = defineMeta({
  model: UserModel,
});

// Create endpoints - TypeScript infers the types from _meta
class UserCreate extends MemoryCreateEndpoint {
  _meta = userMeta;

  schema = {
    tags: ['Users'],
    summary: 'Create a new user',
  };

  async before(data: Partial<User>) {
    // Add timestamps
    return {
      ...data,
      createdAt: new Date().toISOString(),
    } as User;
  }
}

class UserList extends MemoryListEndpoint {
  _meta = userMeta;

  schema = {
    tags: ['Users'],
    summary: 'List all users',
  };

  // Configure filtering
  filterFields = ['role'];
  searchFields = ['name', 'email'];
  orderByFields = ['name', 'createdAt'];
  defaultOrderBy = 'createdAt';
  defaultOrderDirection: 'asc' | 'desc' = 'desc';
}

class UserRead extends MemoryReadEndpoint {
  _meta = userMeta;

  schema = {
    tags: ['Users'],
    summary: 'Get a user by ID',
  };
}

class UserUpdate extends MemoryUpdateEndpoint {
  _meta = userMeta;

  schema = {
    tags: ['Users'],
    summary: 'Update a user',
  };

  // Control which fields can be updated
  allowedUpdateFields = ['name', 'role'];
}

class UserDelete extends MemoryDeleteEndpoint {
  _meta = userMeta;

  schema = {
    tags: ['Users'],
    summary: 'Delete a user',
  };
}

// Create the app
const app = fromHono(new Hono());

// Register CRUD endpoints - no more `as any` needed!
registerCrud(app, '/users', {
  create: UserCreate,
  list: UserList,
  read: UserRead,
  update: UserUpdate,
  delete: UserDelete,
});

// OpenAPI documentation
app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'User API',
    version: '1.0.0',
    description: 'A simple user management API',
  },
});

// Swagger UI and ReDoc
setupSwaggerUI(app, { docsPath: '/docs', specPath: '/openapi.json' });
setupReDoc(app, { redocPath: '/redoc', specPath: '/openapi.json', title: 'User API' });

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Start server
const port = Number(process.env.PORT) || 3456;
console.log(`Server running at http://localhost:${port}`);
console.log(`Swagger UI at http://localhost:${port}/docs`);
console.log(`ReDoc at http://localhost:${port}/redoc`);
console.log(`OpenAPI JSON at http://localhost:${port}/openapi.json`);

serve({
  fetch: app.fetch,
  port,
});
