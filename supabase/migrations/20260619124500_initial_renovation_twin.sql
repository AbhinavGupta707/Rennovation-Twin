-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'UPLOADED', 'PARSED', 'PLAN_CONFIRMED', 'MODEL_GENERATED', 'VARIANTS_GENERATED', 'SHARED');

-- CreateEnum
CREATE TYPE "PlanSource" AS ENUM ('AUTO_PARSE', 'MANUAL_EDIT', 'SAMPLE');

-- CreateEnum
CREATE TYPE "ScreenshotKind" AS ENUM ('MODEL_VIEW');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "anonymousUserId" TEXT,
    "postcode" TEXT,
    "addressLabel" TEXT,
    "planImageUrl" TEXT,
    "originalFileUrl" TEXT,
    "scalePxPerMeter" DOUBLE PRECISION,
    "currentPlanId" TEXT,
    "shareToken" TEXT,
    "stateJson" JSONB,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanVersion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "source" "PlanSource" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "planJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "planImageUrl" TEXT NOT NULL,
    "imageWidth" INTEGER NOT NULL,
    "imageHeight" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignVariant" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "variantJson" JSONB NOT NULL,
    "screenshotUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "props" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportExport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "screenshotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenshotAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "ScreenshotKind" NOT NULL,
    "imageDataUrl" TEXT NOT NULL,
    "variantName" TEXT,
    "cameraPreset" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreenshotAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_shareToken_key" ON "Project"("shareToken");

-- AddForeignKey
ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadAsset" ADD CONSTRAINT "UploadAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignVariant" ADD CONSTRAINT "DesignVariant_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportExport" ADD CONSTRAINT "ReportExport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportExport" ADD CONSTRAINT "ReportExport_screenshotId_fkey" FOREIGN KEY ("screenshotId") REFERENCES "ScreenshotAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenshotAsset" ADD CONSTRAINT "ScreenshotAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
