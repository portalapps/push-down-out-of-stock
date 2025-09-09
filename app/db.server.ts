// DATABASE CONNECTION SETUP
// This file creates and manages our database connection using Prisma
// It ensures we have a single, reusable database connection across our app

// Import the generated Prisma client (auto-generated from our schema.prisma)
import { PrismaClient } from "@prisma/client";

// TYPESCRIPT GLOBAL DECLARATION
// Tell TypeScript that we're adding a prismaGlobal property to the global object
// This is needed for our development mode connection caching
declare global {
  var prismaGlobal: PrismaClient;
}

// DEVELOPMENT MODE CONNECTION CACHING
// In development, store the database connection globally to prevent multiple connections
// This prevents "too many database connections" errors when the server hot-reloads
if (process.env.NODE_ENV !== "production") {
  // Only create a new connection if one doesn't already exist globally
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

// DATABASE CONNECTION CREATION
// Force PostgreSQL connection URL to override any SQLite configuration
// Force the serverless-optimized connection string for production
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres.gbfvnmdjgnggnrvhyxgp:_MQZQ6BTSmsWy%2FY@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1";

// Log database URL for debugging (masking password)
console.log("[DEBUG] Using DATABASE_URL:", DATABASE_URL.replace(/:[^:@]+@/, ":***@"));

// Use the globally cached connection in development, or create a new one in production
const prisma = global.prismaGlobal ?? new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  },
  log: process.env.NODE_ENV === "production" ? ["error"] : ["query", "info", "warn", "error"]
});

// Also set global for development caching
if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}

// Export the database connection for use throughout our app
// Other files will import this to perform database operations like:
// - Creating/reading/updating/deleting collection settings
// - Managing exclusion tags  
// - Storing session information
export default prisma;
