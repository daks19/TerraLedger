-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('LAND_OWNER', 'BUYER', 'GOVERNMENT_OFFICIAL', 'SURVEYOR', 'NOTARY', 'ADMIN');

-- CreateEnum
CREATE TYPE "KYCStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'FUNDED', 'VERIFIED', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ParcelStatus" AS ENUM ('ACTIVE', 'TRANSFERRED', 'DISPUTED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'EVIDENCE_PHASE', 'RESOLVED', 'REJECTED', 'APPEALED');

-- CreateEnum
CREATE TYPE "InheritancePlanStatus" AS ENUM ('ACTIVE', 'TRIGGERED', 'EXECUTING', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT,
    "passwordHash" TEXT,
    "roles" "UserRole"[],
    "kycStatus" "KYCStatus" NOT NULL DEFAULT 'PENDING',
    "aadhaarHash" TEXT,
    "panHash" TEXT,
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "metadataUri" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandParcel" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "surveyNumber" TEXT NOT NULL,
    "areaSqM" DECIMAL(15,2) NOT NULL,
    "village" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "geometry" geometry(Polygon, 4326),
    "boundaryHash" TEXT,
    "ipfsDocHash" TEXT,
    "price" DECIMAL(30,0),
    "isForSale" BOOLEAN NOT NULL DEFAULT false,
    "status" "ParcelStatus" NOT NULL DEFAULT 'ACTIVE',
    "blockchainTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandParcel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelOwnerHistory" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "ownerWallet" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3),
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParcelOwnerHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "escrowId" INTEGER,
    "parcelId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "userId" TEXT,
    "amount" DECIMAL(30,0) NOT NULL,
    "platformFee" DECIMAL(30,0),
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "sellerApproved" BOOLEAN NOT NULL DEFAULT false,
    "buyerApproved" BOOLEAN NOT NULL DEFAULT false,
    "govtApproved" BOOLEAN NOT NULL DEFAULT false,
    "documentsHash" TEXT,
    "blockchainHash" TEXT,
    "deadline" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "disputeId" INTEGER,
    "parcelId" TEXT NOT NULL,
    "filerId" TEXT NOT NULL,
    "affectedParcelIds" TEXT[],
    "description" TEXT NOT NULL,
    "evidenceHash" TEXT,
    "additionalEvidence" TEXT[],
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionType" TEXT,
    "resolutionDetails" TEXT,
    "newBoundaryHash" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyReport" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "surveyorId" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "reportHash" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "isValid" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InheritancePlan" (
    "id" TEXT NOT NULL,
    "planId" INTEGER,
    "ownerId" TEXT NOT NULL,
    "parcelIds" TEXT[],
    "willHash" TEXT,
    "deathCertHash" TEXT,
    "status" "InheritancePlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "useAgeMilestones" BOOLEAN NOT NULL DEFAULT false,
    "triggeredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InheritancePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Heir" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "percentage" INTEGER NOT NULL,
    "releaseAge" INTEGER,
    "birthDate" TIMESTAMP(3),
    "hasClaimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Heir_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseMilestone" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "percentage" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleaseMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ipfsHash" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "parcelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_InheritancePlanToLandParcel" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_walletAddress_idx" ON "User"("walletAddress");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_kycStatus_idx" ON "User"("kycStatus");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "LandParcel_parcelId_key" ON "LandParcel"("parcelId");

-- CreateIndex
CREATE UNIQUE INDEX "LandParcel_surveyNumber_key" ON "LandParcel"("surveyNumber");

-- CreateIndex
CREATE INDEX "LandParcel_parcelId_idx" ON "LandParcel"("parcelId");

-- CreateIndex
CREATE INDEX "LandParcel_surveyNumber_idx" ON "LandParcel"("surveyNumber");

-- CreateIndex
CREATE INDEX "LandParcel_ownerId_idx" ON "LandParcel"("ownerId");

-- CreateIndex
CREATE INDEX "LandParcel_status_idx" ON "LandParcel"("status");

-- CreateIndex
CREATE INDEX "LandParcel_district_village_idx" ON "LandParcel"("district", "village");

-- CreateIndex
CREATE INDEX "ParcelOwnerHistory_parcelId_idx" ON "ParcelOwnerHistory"("parcelId");

-- CreateIndex
CREATE INDEX "ParcelOwnerHistory_ownerWallet_idx" ON "ParcelOwnerHistory"("ownerWallet");

-- CreateIndex
CREATE INDEX "Transaction_parcelId_idx" ON "Transaction"("parcelId");

-- CreateIndex
CREATE INDEX "Transaction_sellerId_idx" ON "Transaction"("sellerId");

-- CreateIndex
CREATE INDEX "Transaction_buyerId_idx" ON "Transaction"("buyerId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_escrowId_idx" ON "Transaction"("escrowId");

-- CreateIndex
CREATE INDEX "Dispute_parcelId_idx" ON "Dispute"("parcelId");

-- CreateIndex
CREATE INDEX "Dispute_filerId_idx" ON "Dispute"("filerId");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyReport_disputeId_key" ON "SurveyReport"("disputeId");

-- CreateIndex
CREATE INDEX "SurveyReport_surveyorId_idx" ON "SurveyReport"("surveyorId");

-- CreateIndex
CREATE INDEX "InheritancePlan_ownerId_idx" ON "InheritancePlan"("ownerId");

-- CreateIndex
CREATE INDEX "InheritancePlan_status_idx" ON "InheritancePlan"("status");

-- CreateIndex
CREATE INDEX "Heir_planId_idx" ON "Heir"("planId");

-- CreateIndex
CREATE INDEX "Heir_userId_idx" ON "Heir"("userId");

-- CreateIndex
CREATE INDEX "ReleaseMilestone_planId_idx" ON "ReleaseMilestone"("planId");

-- CreateIndex
CREATE INDEX "AuditLog_parcelId_idx" ON "AuditLog"("parcelId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Document_ipfsHash_key" ON "Document"("ipfsHash");

-- CreateIndex
CREATE INDEX "Document_ipfsHash_idx" ON "Document"("ipfsHash");

-- CreateIndex
CREATE INDEX "Document_uploaderId_idx" ON "Document"("uploaderId");

-- CreateIndex
CREATE INDEX "Document_parcelId_idx" ON "Document"("parcelId");

-- CreateIndex
CREATE INDEX "Document_type_idx" ON "Document"("type");

-- CreateIndex
CREATE UNIQUE INDEX "_InheritancePlanToLandParcel_AB_unique" ON "_InheritancePlanToLandParcel"("A", "B");

-- CreateIndex
CREATE INDEX "_InheritancePlanToLandParcel_B_index" ON "_InheritancePlanToLandParcel"("B");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandParcel" ADD CONSTRAINT "LandParcel_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelOwnerHistory" ADD CONSTRAINT "ParcelOwnerHistory_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "LandParcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "LandParcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "LandParcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_filerId_fkey" FOREIGN KEY ("filerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyReport" ADD CONSTRAINT "SurveyReport_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyReport" ADD CONSTRAINT "SurveyReport_surveyorId_fkey" FOREIGN KEY ("surveyorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InheritancePlan" ADD CONSTRAINT "InheritancePlan_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Heir" ADD CONSTRAINT "Heir_planId_fkey" FOREIGN KEY ("planId") REFERENCES "InheritancePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Heir" ADD CONSTRAINT "Heir_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseMilestone" ADD CONSTRAINT "ReleaseMilestone_planId_fkey" FOREIGN KEY ("planId") REFERENCES "InheritancePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "LandParcel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InheritancePlanToLandParcel" ADD CONSTRAINT "_InheritancePlanToLandParcel_A_fkey" FOREIGN KEY ("A") REFERENCES "InheritancePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InheritancePlanToLandParcel" ADD CONSTRAINT "_InheritancePlanToLandParcel_B_fkey" FOREIGN KEY ("B") REFERENCES "LandParcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
