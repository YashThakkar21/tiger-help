-- CreateEnum
CREATE TYPE "ShiftSlotStatus" AS ENUM ('SCHEDULED', 'OPEN');

-- CreateTable
CREATE TABLE "ScheduledShift" (
    "id" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" "ShiftSlotStatus" NOT NULL DEFAULT 'SCHEDULED',
    "assignedToId" TEXT,
    "droppedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledShift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledShift_assignedToId_startsAt_idx" ON "ScheduledShift"("assignedToId", "startsAt");

-- CreateIndex
CREATE INDEX "ScheduledShift_status_startsAt_idx" ON "ScheduledShift"("status", "startsAt");

-- AddForeignKey
ALTER TABLE "ScheduledShift" ADD CONSTRAINT "ScheduledShift_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledShift" ADD CONSTRAINT "ScheduledShift_droppedById_fkey" FOREIGN KEY ("droppedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
