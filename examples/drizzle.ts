/**
 * Example: Hono CRUD with Drizzle ORM
 *
 * This example demonstrates how to use hono-crud with Drizzle ORM and SQLite.
 *
 * Setup:
 * 1. npm install drizzle-orm @libsql/client
 * 2. Create the database file and tables (see below)
 * 3. Run with: npx tsx examples/drizzle.ts
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { z } from 'zod';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { fromHono, registerCrud, defineModel, defineMeta } from '../src/index.js';
import {
  DrizzleCreateEndpoint,
  DrizzleReadEndpoint,
  DrizzleUpdateEndpoint,
  DrizzleDeleteEndpoint,
  DrizzleListEndpoint,
  type DrizzleDatabase,
} from '../src/adapters/drizzle/index.js';

// Create SQLite client
const client = createClient({
  url: 'file:./local.db',
});

// Create Drizzle instance
const db = drizzle(client);

// Cast to DrizzleDatabase for type safety
const typedDb = db as unknown as DrizzleDatabase;

// Define the Drizzle table schema
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role', { enum: ['admin', 'user'] }).notNull().default('user'),
  age: integer('age'),
  createdAt: text('created_at').notNull(),
});

// Define Zod schema for validation
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['admin', 'user']),
  age: z.number().int().positive().optional(),
  createdAt: z.string(),
});

type User = z.infer<typeof UserSchema>;

// Create the model configuration using type-safe helper
const UserModel = defineModel({
  tableName: 'users',
  schema: UserSchema,
  primaryKeys: ['id'],
  table: users, // Link to Drizzle table
});

// Meta configuration using type-safe helper
const userMeta = defineMeta({
  model: UserModel,
});

// Create Endpoints - TypeScript infers types from _meta
class UserCreate extends DrizzleCreateEndpoint {
  _meta = userMeta;
  db = typedDb;

  schema = {
    tags: ['Users'],
    summary: 'Create a new user',
  };

  async before(data: Partial<User>) {
    return {
      ...data,
      createdAt: new Date().toISOString(),
    } as User;
  }
}

class UserList extends DrizzleListEndpoint {
  _meta = userMeta;
  db = typedDb;

  schema = {
    tags: ['Users'],
    summary: 'List all users',
  };

  // Configure filtering, searching, and sorting
  filterFields = ['role'];
  filterConfig = {
    age: ['eq', 'gt', 'gte', 'lt', 'lte', 'between'] as const,
  };
  searchFields = ['name', 'email'];
  orderByFields = ['name', 'createdAt', 'age'];
  defaultOrderBy = 'createdAt';
  defaultOrderDirection: 'asc' | 'desc' = 'desc';
}

class UserRead extends DrizzleReadEndpoint {
  _meta = userMeta;
  db = typedDb;

  schema = {
    tags: ['Users'],
    summary: 'Get a user by ID',
  };
}

class UserUpdate extends DrizzleUpdateEndpoint {
  _meta = userMeta;
  db = typedDb;

  schema = {
    tags: ['Users'],
    summary: 'Update a user',
  };

  // Only allow updating these fields
  allowedUpdateFields = ['name', 'role', 'age'];
}

class UserDelete extends DrizzleDeleteEndpoint {
  _meta = userMeta;
  db = typedDb;

  schema = {
    tags: ['Users'],
    summary: 'Delete a user',
  };
}

// Create the app
const app = fromHono(new Hono());

// Register all CRUD endpoints for /users - no more `as any` needed!
registerCrud(app, '/users', {
  create: UserCreate,
  list: UserList,
  read: UserRead,
  update: UserUpdate,
  delete: UserDelete,
});

// Setup OpenAPI documentation
app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'User API with Drizzle',
    version: '1.0.0',
    description: 'A full CRUD API for users using Hono and Drizzle ORM',
  },
});

// Health check endpoint
app.get('/health', (c) => c.json({ status: 'ok' }));

// Initialize database
async function initDb() {
  // Create table if not exists
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      age INTEGER,
      created_at TEXT NOT NULL
    )
  `);

  console.log('Database initialized');
}

// Start server
const port = Number(process.env.PORT) || 3456;

initDb()
  .then(() => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`OpenAPI docs at http://localhost:${port}/openapi.json`);
    console.log('');
    console.log('Available endpoints:');
    console.log('  POST   /users          - Create a user');
    console.log('  GET    /users          - List all users');
    console.log('  GET    /users/:id      - Get a user');
    console.log('  PATCH  /users/:id      - Update a user');
    console.log('  DELETE /users/:id      - Delete a user');
    console.log('');
    console.log('Query parameters for list:');
    console.log('  ?role=admin            - Filter by role');
    console.log('  ?age[gte]=18           - Age greater than or equal to 18');
    console.log('  ?search=john           - Search by name or email');
    console.log('  ?order_by=name&order_by_direction=asc');
    console.log('  ?page=1&per_page=20');

    serve({
      fetch: app.fetch,
      port,
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
