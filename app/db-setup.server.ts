import { PrismaClient } from "@prisma/client";

let setupPromise: Promise<void> | null = null;

export async function ensureDbSetup() {
  if (setupPromise) {
    return setupPromise;
  }

  setupPromise = setupDatabase();
  return setupPromise;
}

async function setupDatabase() {
  try {
    console.log("Setting up database...");
    const prisma = new PrismaClient();
    
    // Try to create the Session table if it doesn't exist
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Session" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "shop" TEXT NOT NULL,
        "state" TEXT NOT NULL,
        "isOnline" BOOLEAN NOT NULL DEFAULT false,
        "scope" TEXT,
        "expires" TIMESTAMP(3),
        "accessToken" TEXT NOT NULL,
        "userId" BIGINT,
        "firstName" TEXT,
        "lastName" TEXT,
        "email" TEXT,
        "accountOwner" BOOLEAN NOT NULL DEFAULT false,
        "locale" TEXT,
        "collaborator" BOOLEAN DEFAULT false,
        "emailVerified" BOOLEAN DEFAULT false
      );
    `;

    // Create other tables if they don't exist
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "CollectionSetting" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "shop" TEXT NOT NULL,
        "collectionId" TEXT NOT NULL,
        "sortType" TEXT NOT NULL,
        "enabled" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("shop", "collectionId")
      );
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "ExclusionTag" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "shop" TEXT NOT NULL,
        "collectionId" TEXT NOT NULL,
        "tag" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("shop", "collectionId", "tag")
      );
    `;

    await prisma.$disconnect();
    console.log("Database setup completed successfully");
  } catch (error) {
    console.error("Database setup failed:", error);
    throw error;
  }
}