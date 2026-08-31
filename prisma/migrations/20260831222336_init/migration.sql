-- CreateTable
CREATE TABLE "Payer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "planType" TEXT NOT NULL,
    "allowedRate" REAL NOT NULL,
    "avgDaysToPay" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mrn" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dob" DATETIME,
    "sex" TEXT NOT NULL,
    "phone" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InsurancePolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "groupNumber" TEXT,
    "rank" TEXT NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "copay" REAL NOT NULL,
    "deductible" REAL NOT NULL,
    "deductibleMet" REAL NOT NULL,
    "coinsuranceRate" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InsurancePolicy_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InsurancePolicy_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "npi" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "taxonomy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProcedureCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "defaultCharge" REAL NOT NULL,
    "isEvalAndManagement" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DiagnosisCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sexSpecific" TEXT NOT NULL DEFAULT 'ANY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Encounter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "dateOfService" DATETIME NOT NULL,
    "placeOfService" TEXT,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Encounter_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Encounter_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EncounterDiagnosis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "encounterId" TEXT NOT NULL,
    "diagnosisCode" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EncounterDiagnosis_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EncounterDiagnosis_diagnosisCode_fkey" FOREIGN KEY ("diagnosisCode") REFERENCES "DiagnosisCode" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChargeLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "encounterId" TEXT NOT NULL,
    "cptCode" TEXT NOT NULL,
    "modifiers" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "chargeAmount" REAL NOT NULL,
    "diagnosisPointers" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChargeLine_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claimNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "policyId" TEXT,
    "status" TEXT NOT NULL,
    "totalCharge" REAL NOT NULL,
    "totalAllowed" REAL NOT NULL,
    "totalPaid" REAL NOT NULL,
    "totalAdjustment" REAL NOT NULL,
    "patientResponsibility" REAL NOT NULL,
    "balance" REAL NOT NULL,
    "billedAt" DATETIME,
    "submittedAt" DATETIME,
    "lastScrubbedAt" DATETIME,
    "cleanOnFirstPass" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Claim_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Claim_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Claim_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Claim_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "InsurancePolicy" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClaimLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claimId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "cptCode" TEXT NOT NULL,
    "modifiers" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "chargeAmount" REAL NOT NULL,
    "allowedAmount" REAL NOT NULL,
    "paidAmount" REAL NOT NULL,
    "adjustmentAmount" REAL NOT NULL,
    "patientResponsibility" REAL NOT NULL,
    "diagnosisPointers" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClaimLine_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClaimEdit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claimId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "field" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClaimEdit_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClaimEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claimId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClaimEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Remittance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checkNumber" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "paymentDate" DATETIME NOT NULL,
    "totalPaid" REAL NOT NULL,
    "postedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Remittance_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RemittanceLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "remittanceId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "claimLineId" TEXT NOT NULL,
    "allowedAmount" REAL NOT NULL,
    "paidAmount" REAL NOT NULL,
    "adjustmentAmount" REAL NOT NULL,
    "patientResponsibility" REAL NOT NULL,
    "carc" TEXT,
    "rarc" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RemittanceLine_remittanceId_fkey" FOREIGN KEY ("remittanceId") REFERENCES "Remittance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RemittanceLine_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RemittanceLine_claimLineId_fkey" FOREIGN KEY ("claimLineId") REFERENCES "ClaimLine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Denial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claimId" TEXT NOT NULL,
    "claimLineId" TEXT,
    "carc" TEXT NOT NULL,
    "rarc" TEXT,
    "reason" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "assignedTo" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Denial_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Denial_claimLineId_fkey" FOREIGN KEY ("claimLineId") REFERENCES "ClaimLine" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Payer_payerId_key" ON "Payer"("payerId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_mrn_key" ON "Patient"("mrn");

-- CreateIndex
CREATE INDEX "InsurancePolicy_patientId_idx" ON "InsurancePolicy"("patientId");

-- CreateIndex
CREATE INDEX "InsurancePolicy_payerId_idx" ON "InsurancePolicy"("payerId");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_npi_key" ON "Provider"("npi");

-- CreateIndex
CREATE UNIQUE INDEX "ProcedureCode_code_key" ON "ProcedureCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosisCode_code_key" ON "DiagnosisCode"("code");

-- CreateIndex
CREATE INDEX "Encounter_patientId_idx" ON "Encounter"("patientId");

-- CreateIndex
CREATE INDEX "Encounter_providerId_idx" ON "Encounter"("providerId");

-- CreateIndex
CREATE INDEX "Encounter_dateOfService_idx" ON "Encounter"("dateOfService");

-- CreateIndex
CREATE INDEX "EncounterDiagnosis_encounterId_idx" ON "EncounterDiagnosis"("encounterId");

-- CreateIndex
CREATE INDEX "EncounterDiagnosis_diagnosisCode_idx" ON "EncounterDiagnosis"("diagnosisCode");

-- CreateIndex
CREATE INDEX "ChargeLine_encounterId_idx" ON "ChargeLine"("encounterId");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_claimNumber_key" ON "Claim"("claimNumber");

-- CreateIndex
CREATE INDEX "Claim_patientId_idx" ON "Claim"("patientId");

-- CreateIndex
CREATE INDEX "Claim_encounterId_idx" ON "Claim"("encounterId");

-- CreateIndex
CREATE INDEX "Claim_payerId_idx" ON "Claim"("payerId");

-- CreateIndex
CREATE INDEX "Claim_policyId_idx" ON "Claim"("policyId");

-- CreateIndex
CREATE INDEX "Claim_status_idx" ON "Claim"("status");

-- CreateIndex
CREATE INDEX "ClaimLine_claimId_idx" ON "ClaimLine"("claimId");

-- CreateIndex
CREATE INDEX "ClaimEdit_claimId_idx" ON "ClaimEdit"("claimId");

-- CreateIndex
CREATE INDEX "ClaimEvent_claimId_idx" ON "ClaimEvent"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "Remittance_checkNumber_key" ON "Remittance"("checkNumber");

-- CreateIndex
CREATE INDEX "Remittance_payerId_idx" ON "Remittance"("payerId");

-- CreateIndex
CREATE INDEX "Remittance_paymentDate_idx" ON "Remittance"("paymentDate");

-- CreateIndex
CREATE INDEX "RemittanceLine_remittanceId_idx" ON "RemittanceLine"("remittanceId");

-- CreateIndex
CREATE INDEX "RemittanceLine_claimId_idx" ON "RemittanceLine"("claimId");

-- CreateIndex
CREATE INDEX "RemittanceLine_claimLineId_idx" ON "RemittanceLine"("claimLineId");

-- CreateIndex
CREATE INDEX "Denial_claimId_idx" ON "Denial"("claimId");

-- CreateIndex
CREATE INDEX "Denial_claimLineId_idx" ON "Denial"("claimLineId");

-- CreateIndex
CREATE INDEX "Denial_category_idx" ON "Denial"("category");

-- CreateIndex
CREATE INDEX "Denial_status_idx" ON "Denial"("status");
