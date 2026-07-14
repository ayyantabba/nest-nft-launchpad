CREATE TYPE "CollectionStatus" AS ENUM ('DRAFT', 'STORAGE_READY', 'READY_TO_DEPLOY', 'DEPLOYING', 'LIVE', 'ENDED', 'FAILED');
CREATE TYPE "DeploymentStatus" AS ENUM ('PREPARED', 'WAITING_FOR_WALLET', 'PENDING', 'CONFIRMED', 'FAILED');
CREATE TYPE "MintStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "walletAddress" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

CREATE TABLE "WalletSession" (
  "id" TEXT NOT NULL,
  "walletAddress" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "signature" TEXT,
  "userId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WalletSession_walletAddress_expiresAt_idx" ON "WalletSession"("walletAddress", "expiresAt");

CREATE TABLE "Collection" (
  "id" TEXT NOT NULL,
  "creatorWallet" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "chainId" INTEGER NOT NULL,
  "chainName" TEXT NOT NULL,
  "mintCurrency" TEXT NOT NULL,
  "mintPriceWei" TEXT NOT NULL,
  "maxSupply" INTEGER NOT NULL,
  "mintedSupply" INTEGER NOT NULL DEFAULT 0,
  "maxPerWallet" INTEGER NOT NULL,
  "royaltyBps" INTEGER NOT NULL,
  "nestFeeBps" INTEGER NOT NULL DEFAULT 500,
  "creatorPayoutWallet" TEXT NOT NULL,
  "status" "CollectionStatus" NOT NULL DEFAULT 'DRAFT',
  "contractAddress" TEXT,
  "txHash" TEXT,
  "metadataBaseUri" TEXT,
  "contractUri" TEXT,
  "websiteUrl" TEXT,
  "socialUrl" TEXT,
  "referralCode" TEXT,
  "mintStartAt" TIMESTAMP(3),
  "mintEndAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Collection_status_createdAt_idx" ON "Collection"("status", "createdAt");
CREATE INDEX "Collection_creatorWallet_createdAt_idx" ON "Collection"("creatorWallet", "createdAt");

CREATE TABLE "ArtworkAsset" (
  "id" TEXT NOT NULL, "collectionId" TEXT NOT NULL, "originalFilename" TEXT NOT NULL,
  "localUrl" TEXT, "ipfsUri" TEXT, "arweaveUri" TEXT, "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL, "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArtworkAsset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ArtworkAsset_collectionId_idx" ON "ArtworkAsset"("collectionId");

CREATE TABLE "MetadataItem" (
  "id" TEXT NOT NULL, "collectionId" TEXT NOT NULL, "tokenId" INTEGER NOT NULL,
  "name" TEXT NOT NULL, "description" TEXT NOT NULL, "imageUri" TEXT NOT NULL,
  "metadataUri" TEXT, "traitsJson" JSONB NOT NULL,
  CONSTRAINT "MetadataItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MetadataItem_collectionId_tokenId_key" ON "MetadataItem"("collectionId", "tokenId");

CREATE TABLE "Deployment" (
  "id" TEXT NOT NULL, "collectionId" TEXT NOT NULL, "chainId" INTEGER NOT NULL,
  "deployerWallet" TEXT NOT NULL, "txHash" TEXT, "contractAddress" TEXT,
  "gasEstimateWei" TEXT, "status" "DeploymentStatus" NOT NULL DEFAULT 'PREPARED',
  "errorMessage" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Deployment_collectionId_createdAt_idx" ON "Deployment"("collectionId", "createdAt");
CREATE INDEX "Deployment_status_updatedAt_idx" ON "Deployment"("status", "updatedAt");

CREATE TABLE "Mint" (
  "id" TEXT NOT NULL, "collectionId" TEXT NOT NULL, "minterWallet" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL, "txHash" TEXT NOT NULL, "totalPaidWei" TEXT NOT NULL,
  "creatorAmountWei" TEXT NOT NULL, "nestFeeAmountWei" TEXT NOT NULL,
  "status" "MintStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Mint_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Mint_txHash_key" ON "Mint"("txHash");
CREATE INDEX "Mint_collectionId_createdAt_idx" ON "Mint"("collectionId", "createdAt");

CREATE TABLE "IndexerEvent" (
  "id" TEXT NOT NULL, "chainId" INTEGER NOT NULL, "contractAddress" TEXT NOT NULL,
  "eventName" TEXT NOT NULL, "txHash" TEXT NOT NULL, "blockNumber" BIGINT NOT NULL,
  "logIndex" INTEGER NOT NULL DEFAULT 0, "payloadJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IndexerEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IndexerEvent_chainId_txHash_logIndex_key" ON "IndexerEvent"("chainId", "txHash", "logIndex");
CREATE INDEX "IndexerEvent_chainId_blockNumber_idx" ON "IndexerEvent"("chainId", "blockNumber");

CREATE TABLE "Referral" (
  "id" TEXT NOT NULL, "referrerWallet" TEXT NOT NULL, "referredWallet" TEXT NOT NULL,
  "collectionId" TEXT, "revenueGenerated" TEXT NOT NULL DEFAULT '0',
  "commissionStatus" TEXT NOT NULL DEFAULT 'PLACEHOLDER', "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminAction" (
  "id" TEXT NOT NULL, "adminWallet" TEXT NOT NULL, "actionType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL, "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WalletSession" ADD CONSTRAINT "WalletSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_creatorWallet_fkey" FOREIGN KEY ("creatorWallet") REFERENCES "User"("walletAddress") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArtworkAsset" ADD CONSTRAINT "ArtworkAsset_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MetadataItem" ADD CONSTRAINT "MetadataItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Mint" ADD CONSTRAINT "Mint_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
