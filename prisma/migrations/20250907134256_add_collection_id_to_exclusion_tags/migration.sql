/*
  Warnings:

  - Added the required column `collectionId` to the `ExclusionTag` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ExclusionTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ExclusionTag" ("createdAt", "id", "shop", "tag", "updatedAt") SELECT "createdAt", "id", "shop", "tag", "updatedAt" FROM "ExclusionTag";
DROP TABLE "ExclusionTag";
ALTER TABLE "new_ExclusionTag" RENAME TO "ExclusionTag";
CREATE UNIQUE INDEX "ExclusionTag_shop_collectionId_tag_key" ON "ExclusionTag"("shop", "collectionId", "tag");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
