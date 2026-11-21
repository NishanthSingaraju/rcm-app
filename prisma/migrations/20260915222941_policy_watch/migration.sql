-- CreateTable
CREATE TABLE "PolicySource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" DATETIME,
    "lastChangedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PolicySource_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PolicySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentHash" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "byteLength" INTEGER NOT NULL,
    CONSTRAINT "PolicySnapshot_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "PolicySource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PolicyChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "fromSnapshotId" TEXT,
    "toSnapshotId" TEXT NOT NULL,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "title" TEXT NOT NULL,
    "addedLines" TEXT NOT NULL,
    "removedLines" TEXT NOT NULL,
    "affectedCodes" TEXT NOT NULL,
    "signals" TEXT NOT NULL DEFAULT '[]',
    "aiSummary" TEXT,
    "aiModel" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PolicyChange_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "PolicySource" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PolicyChange_fromSnapshotId_fkey" FOREIGN KEY ("fromSnapshotId") REFERENCES "PolicySnapshot" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PolicyChange_toSnapshotId_fkey" FOREIGN KEY ("toSnapshotId") REFERENCES "PolicySnapshot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyDigest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "digestDate" DATETIME NOT NULL,
    "changeCount" INTEGER NOT NULL,
    "sourceCount" INTEGER NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "aiModel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Chargemaster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "fileName" TEXT,
    "itemCount" INTEGER NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auditedAt" DATETIME
);

-- CreateTable
CREATE TABLE "ChargemasterItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chargemasterId" TEXT NOT NULL,
    "cptCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "modifiers" TEXT,
    "revenueCode" TEXT,
    "department" TEXT,
    CONSTRAINT "ChargemasterItem_chargemasterId_fkey" FOREIGN KEY ("chargemasterId") REFERENCES "Chargemaster" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditFinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chargemasterId" TEXT NOT NULL,
    "changeId" TEXT,
    "cptCode" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "message" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "evidence" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuditFinding_chargemasterId_fkey" FOREIGN KEY ("chargemasterId") REFERENCES "Chargemaster" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditFinding_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "PolicyChange" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PolicySource_payerId_idx" ON "PolicySource"("payerId");

-- CreateIndex
CREATE INDEX "PolicySnapshot_sourceId_fetchedAt_idx" ON "PolicySnapshot"("sourceId", "fetchedAt");

-- CreateIndex
CREATE INDEX "PolicyChange_sourceId_idx" ON "PolicyChange"("sourceId");

-- CreateIndex
CREATE INDEX "PolicyChange_detectedAt_idx" ON "PolicyChange"("detectedAt");

-- CreateIndex
CREATE INDEX "PolicyChange_status_idx" ON "PolicyChange"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DailyDigest_digestDate_key" ON "DailyDigest"("digestDate");

-- CreateIndex
CREATE INDEX "ChargemasterItem_chargemasterId_idx" ON "ChargemasterItem"("chargemasterId");

-- CreateIndex
CREATE INDEX "ChargemasterItem_cptCode_idx" ON "ChargemasterItem"("cptCode");

-- CreateIndex
CREATE INDEX "AuditFinding_chargemasterId_idx" ON "AuditFinding"("chargemasterId");

-- CreateIndex
CREATE INDEX "AuditFinding_changeId_idx" ON "AuditFinding"("changeId");

-- CreateIndex
CREATE INDEX "AuditFinding_cptCode_idx" ON "AuditFinding"("cptCode");
