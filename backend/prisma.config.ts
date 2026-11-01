// prisma.config.ts — Prisma CLI configuration (required since Prisma ORM 7)
// The DATABASE_URL is no longer read from schema.prisma; it lives here.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});