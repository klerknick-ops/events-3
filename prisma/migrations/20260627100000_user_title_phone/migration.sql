-- Per-user job title + direct phone (used in email signatures).
ALTER TABLE "User" ADD COLUMN "title" TEXT;
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
