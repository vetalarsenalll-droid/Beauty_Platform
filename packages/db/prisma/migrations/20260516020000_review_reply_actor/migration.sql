ALTER TABLE "Review"
  ADD COLUMN "repliedByUserId" INTEGER;

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_repliedByUserId_fkey"
  FOREIGN KEY ("repliedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
