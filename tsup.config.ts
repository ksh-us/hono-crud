import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/adapters/memory/index.ts',
    'src/adapters/drizzle/index.ts',
    'src/adapters/prisma/index.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: ['drizzle-orm', '@prisma/client'],
});
