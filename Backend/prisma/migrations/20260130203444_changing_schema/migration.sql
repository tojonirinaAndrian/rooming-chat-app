/*
  Warnings:

  - You are about to drop the column `people` on the `Room` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[room_name]` on the table `Room` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `sent_by_id` on the `Message` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `room_id` on the `Message` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `room_name` to the `Room` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `created_by` on the `Room` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `password` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Message" DROP COLUMN "sent_by_id",
ADD COLUMN     "sent_by_id" INTEGER NOT NULL,
DROP COLUMN "room_id",
ADD COLUMN     "room_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Room" DROP COLUMN "people",
ADD COLUMN     "people_ids" INTEGER[],
ADD COLUMN     "room_name" TEXT NOT NULL,
DROP COLUMN "created_by",
ADD COLUMN     "created_by" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "password" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Session" (
    "sessionId" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("sessionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Room_room_name_key" ON "Room"("room_name");
