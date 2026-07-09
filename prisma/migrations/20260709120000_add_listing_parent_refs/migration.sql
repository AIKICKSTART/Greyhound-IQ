-- Pup listings link registered parents (sire/dam) so lineage is verifiable
-- before the pup has its own race record. Forward-only, nullable columns.
ALTER TABLE "Listing" ADD COLUMN "sireDogId" TEXT;
ALTER TABLE "Listing" ADD COLUMN "damDogId" TEXT;
