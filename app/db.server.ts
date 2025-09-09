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
// Use the globally cached connection in development, or create a new one in production
// The ?? operator means "use global.prismaGlobal if it exists, otherwise create new PrismaClient"
const prisma = global.prismaGlobal ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

// Export the database connection for use throughout our app
// Other files will import this to perform database operations like:
// - Creating/reading/updating/deleting collection settings
// - Managing exclusion tags  
// - Storing session information
export default prisma;
