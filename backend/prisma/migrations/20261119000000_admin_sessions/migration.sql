-- Server-side admin-web sessions.
--
-- The httpOnly cookie now carries a `sid` (row id) next to the user id, so a
-- stolen cookie can be killed without rotating JWT_SECRET: revoking the row
-- makes the very next request fail. `sessionVersion` is the second, cheaper
-- kill switch used by "log out everywhere" (ban / permission change).
--
-- `expiresAt` is the ABSOLUTE cap (idle window × rolling renewals stay under
-- it), while the cookie itself slides on activity.

ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminSession_userId_createdAt_idx" ON "AdminSession"("userId", "createdAt");
CREATE INDEX "AdminSession_tenantId_createdAt_idx" ON "AdminSession"("tenantId", "createdAt");

ALTER TABLE "AdminSession"
    ADD CONSTRAINT "AdminSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
