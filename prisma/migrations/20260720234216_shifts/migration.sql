-- CreateEnum
CREATE TYPE "QueueBusyness" AS ENUM ('QUIET', 'STEADY', 'SLAMMED');

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "notes" TEXT,
    "busyness" "QueueBusyness",
    "taId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Shift_taId_startedAt_idx" ON "Shift"("taId", "startedAt");

-- CreateIndex
CREATE INDEX "Shift_endedAt_idx" ON "Shift"("endedAt");

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_taId_fkey" FOREIGN KEY ("taId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
