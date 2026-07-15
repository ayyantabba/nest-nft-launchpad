ALTER TABLE "Collection" ADD COLUMN "maxPerTransaction" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Mint"
ADD COLUMN "tokenIds" JSONB,
ADD COLUMN "blockNumber" BIGINT,
ADD COLUMN "confirmedAt" TIMESTAMP(3);

CREATE TABLE "TokenOwnership" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "tokenId" INTEGER NOT NULL,
    "ownerWallet" TEXT NOT NULL,
    "mintTxHash" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TokenOwnership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TokenOwnership_collectionId_tokenId_key"
ON "TokenOwnership"("collectionId", "tokenId");
CREATE INDEX "TokenOwnership_ownerWallet_acquiredAt_idx"
ON "TokenOwnership"("ownerWallet", "acquiredAt");
CREATE INDEX "TokenOwnership_collectionId_tokenId_idx"
ON "TokenOwnership"("collectionId", "tokenId");
ALTER TABLE "TokenOwnership" ADD CONSTRAINT "TokenOwnership_collectionId_fkey"
FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
