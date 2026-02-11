/*
  Warnings:

  - Added the required column `sent_by_name` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "sent_by_name" TEXT NOT NULL;
