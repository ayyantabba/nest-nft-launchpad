CREATE TYPE "RevenueRecipient" AS ENUM ('CREATOR', 'PLATFORM');
CREATE TYPE "RevenueWithdrawalStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

CREATE TABLE "RevenueWithdrawal" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "requesterWallet" TEXT NOT NULL,
    "recipient" "RevenueRecipient" NOT NULL,
    "amountWei" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "status" "RevenueWithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "blockNumber" BIGINT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RevenueWithdrawal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RevenueWithdrawal_txHash_key" ON "RevenueWithdrawal"("txHash");
CREATE INDEX "RevenueWithdrawal_collectionId_recipient_status_idx" ON "RevenueWithdrawal"("collectionId", "recipient", "status");
CREATE INDEX "RevenueWithdrawal_status_createdAt_idx" ON "RevenueWithdrawal"("status", "createdAt");

ALTER TABLE "RevenueWithdrawal"
ADD CONSTRAINT "RevenueWithdrawal_collectionId_fkey"
FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
