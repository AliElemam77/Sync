-- Business rules: commission, task weight, salary payout method, leave accrual, Management department.
-- Additive only: no column or row is removed.

-- AlterEnum
ALTER TYPE "AdjustmentType" ADD VALUE 'COMMISSION';

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "commission_per_task" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "employee_profiles" ADD COLUMN     "leave_accrued_through" DATE,
ALTER COLUMN "annual_leave_days" SET DEFAULT 0,
ALTER COLUMN "annual_leave_days" SET DATA TYPE DECIMAL(6,2);

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "completed_at" TIMESTAMPTZ(6),
ADD COLUMN     "weight" DECIMAL(3,1) NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "salary_profiles" ADD COLUMN     "payment_method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER';


-- =============================================================================
-- Data (runs once with this migration)
-- =============================================================================

-- Tasks accepted before completed_at existed: use their last update as the acceptance time
UPDATE "tasks" SET "completed_at" = "updated_at" WHERE "status" = 'DONE' AND "completed_at" IS NULL;

-- Salary no longer comes from bank details. Existing salary profiles: cash unless a bank account exists
UPDATE "salary_profiles" s
SET "payment_method" = 'CASH'
WHERE NOT EXISTS (
  SELECT 1 FROM "bank_infos" b
  WHERE b."employee_profile_id" = s."employee_id"
    AND COALESCE(b."account_number", b."iban") IS NOT NULL
);

-- Employees whose salary was only entered in the bank form get a salary profile from it
INSERT INTO "salary_profiles" ("id", "employee_id", "base_salary", "payment_method", "created_at", "updated_at")
SELECT gen_random_uuid(),
       b."employee_profile_id",
       b."basic_salary",
       CASE WHEN COALESCE(b."account_number", b."iban") IS NOT NULL
            THEN 'BANK_TRANSFER'::"PaymentMethod" ELSE 'CASH'::"PaymentMethod" END,
       now(),
       now()
FROM "bank_infos" b
WHERE NOT EXISTS (SELECT 1 FROM "salary_profiles" s WHERE s."employee_id" = b."employee_profile_id");

-- Annual leave accrual starts next month: current balances are kept as the opening balance
UPDATE "employee_profiles"
SET "leave_accrued_through" = date_trunc('month', now() AT TIME ZONE 'Africa/Cairo')::date
WHERE "leave_accrued_through" IS NULL;

-- The Management department: its members get full access to every module
INSERT INTO "departments" ("id", "name", "code", "description", "is_active", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'الإدارة', 'MGMT', 'الإدارة العليا: صلاحية كاملة على كل الأقسام والوحدات', true, now(), now())
ON CONFLICT ("code") DO NOTHING;

-- Employees already ENDED or INACTIVE must not be able to log in (the app now enforces this on
-- every status change; existing rows predate the rule)
UPDATE "users"
SET "is_active" = false
WHERE "id" IN (
  SELECT "user_id" FROM "employee_profiles" WHERE "status" IN ('ENDED', 'INACTIVE')
);

-- monthly_permission_hours used to be decremented on every approval and never reset. It is now the
-- monthly ALLOWANCE (what is left is computed per month), so restore the default allowance of 4
-- hours; re-enter any custom allowance afterwards from the employee edit page.
UPDATE "employee_profiles" SET "monthly_permission_hours" = 4;
