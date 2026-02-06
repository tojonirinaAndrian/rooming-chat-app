-- AlterTable
ALTER TABLE "User" ADD COLUMN     "joined_rooms" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
