-- AlterTable
ALTER TABLE "task_comments" ADD COLUMN     "attachment_urls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "attachment_urls" TEXT[] DEFAULT ARRAY[]::TEXT[];
