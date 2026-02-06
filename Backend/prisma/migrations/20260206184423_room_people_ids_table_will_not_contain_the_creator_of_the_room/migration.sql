/*
  Warnings:

  - You are about to drop the column `people_ids` on the `Room` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Room" DROP COLUMN "people_ids",
ADD COLUMN     "gueists_ids" INTEGER[];
