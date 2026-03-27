-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "adminToken" TEXT NOT NULL,
    "inviteToken" TEXT NOT NULL,
    "feedbackOpen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "submitToken" TEXT NOT NULL,
    "publicKeyJwk" TEXT,
    "encryptedPrivateKey" TEXT,
    "privateKeyIv" TEXT,
    "viewTokenHash" TEXT,
    "hasSubmitted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Member_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetMemberId" TEXT NOT NULL,
    "ephemeralPubKey" TEXT NOT NULL,
    "encryptedData" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Feedback_targetMemberId_fkey" FOREIGN KEY ("targetMemberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_adminToken_key" ON "Team"("adminToken");

-- CreateIndex
CREATE UNIQUE INDEX "Team_inviteToken_key" ON "Team"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "Member_submitToken_key" ON "Member"("submitToken");

-- CreateIndex
CREATE UNIQUE INDEX "Member_viewTokenHash_key" ON "Member"("viewTokenHash");
