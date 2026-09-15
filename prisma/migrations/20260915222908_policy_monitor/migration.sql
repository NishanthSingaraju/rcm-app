-- CreateTable
CREATE TABLE "PolicySource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "payer" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "checkedAt" DATETIME,
    "lastError" TEXT,
    "lockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PolicySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolicySnapshot_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "PolicySource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PolicyUpdate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "codes" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "previousText" TEXT NOT NULL,
    "currentText" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "effectiveAt" DATETIME,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolicyUpdate_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "PolicySource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChargeCatalog" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'active',
    "filename" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ChargeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "catalogId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "charge" REAL NOT NULL,
    "annualVolume" INTEGER,
    CONSTRAINT "ChargeEntry_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "ChargeCatalog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PolicyBriefing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "day" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL,
    "inputHash" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "PolicySource_url_isDemo_key" ON "PolicySource"("url", "isDemo");

-- CreateIndex
CREATE INDEX "PolicySnapshot_sourceId_createdAt_idx" ON "PolicySnapshot"("sourceId", "createdAt");

-- CreateIndex
CREATE INDEX "PolicyUpdate_sourceId_createdAt_idx" ON "PolicyUpdate"("sourceId", "createdAt");

-- CreateIndex
CREATE INDEX "ChargeEntry_catalogId_code_idx" ON "ChargeEntry"("catalogId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyBriefing_day_isDemo_key" ON "PolicyBriefing"("day", "isDemo");
