import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/database/schema.ts',
  out: './src/lib/database/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './database.sqlite',
  },
  verbose: true,
  strict: true,
});