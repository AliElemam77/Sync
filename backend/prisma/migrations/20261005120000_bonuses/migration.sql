-- CreateEnum
CREATE TYPE "BonusKind" AS ENUM ('PAY', 'LEAVE');

-- AlterEnum
ALTER TYPE "AdjustmentType" ADD VALUE 'EXTRA_DAY';

-- CreateTable
CREATE TABLE "bonuses" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "kind" "BonusKind" NOT NULL DEFAULT 'PAY',
    "days" DECIMAL(4,1) NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "payroll_month" DATE NOT NULL,
    "granted_by_id" UUID NOT NULL,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bonuses_employee_id_idx" ON "bonuses"("employee_id");

-- CreateIndex
CREATE INDEX "bonuses_payroll_month_idx" ON "bonuses"("payroll_month");

-- AddForeignKey
ALTER TABLE "bonuses" ADD CONSTRAINT "bonuses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonuses" ADD CONSTRAINT "bonuses_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonuses" ADD CONSTRAINT "bonuses_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

