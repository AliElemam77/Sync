-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('RS', 'LS');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'TRAINING');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PROBATION', 'ENDED');

-- CreateEnum
CREATE TYPE "EmergencyRelationship" AS ENUM ('FATHER', 'MOTHER', 'BROTHER', 'SISTER', 'SPOUSE', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('NATIONAL_ID', 'PASSPORT', 'CV', 'CONTRACT', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'REVIEW', 'WAITING_FOR_CLIENT', 'NEEDS_REVISION', 'DONE');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskAssignmentType" AS ENUM ('DEPARTMENT', 'SELF_OR_TEAM');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LEAVE', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'SICK', 'UNPAID', 'MATERNITY');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'WORK_GROUP', 'PUBLIC_GROUP');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('MEMBER', 'ADMIN');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('HARDWARE', 'SOFTWARE', 'FURNITURE', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'IN_MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('PAYROLL', 'ASSET_PURCHASE', 'SUBSCRIPTION', 'CLIENT_PAYMENT', 'OPERATIONAL_EXPENSE', 'TAX_AND_GOVERNMENT', 'INVESTMENT', 'MISC');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'CREDIT_CARD', 'CHEQUE', 'ONLINE_GATEWAY', 'OTHER');

-- CreateEnum
CREATE TYPE "PayrollCycleStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('BONUS', 'PENALTY', 'OVERTIME');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "module" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" "AuditAction" NOT NULL,
    "entity" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(255),
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "description" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "head_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "department_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levels" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 1,
    "description" VARCHAR(255),
    "position_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "employee_code" VARCHAR(20) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "dob" DATE,
    "gender" "Gender" NOT NULL DEFAULT 'MALE',
    "avatar_url" TEXT,
    "shift_type" "ShiftType" NOT NULL DEFAULT 'RS',
    "monthly_permission_hours" INTEGER NOT NULL DEFAULT 4,
    "annual_leave_days" INTEGER NOT NULL DEFAULT 21,
    "company" VARCHAR(100) NOT NULL DEFAULT 'Tawfeer',
    "branch" VARCHAR(100) NOT NULL DEFAULT 'Headquarters',
    "department_id" UUID NOT NULL,
    "position_id" UUID NOT NULL,
    "level_id" UUID,
    "joining_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employment_type" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "address" TEXT,
    "alt_phone" VARCHAR(30),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employee_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" UUID NOT NULL,
    "employee_profile_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "relationship" "EmergencyRelationship" NOT NULL DEFAULT 'OTHER',
    "phone" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_infos" (
    "id" UUID NOT NULL,
    "employee_profile_id" UUID NOT NULL,
    "bank_name" VARCHAR(100),
    "account_holder" VARCHAR(150),
    "account_number" VARCHAR(50),
    "iban" VARCHAR(50),
    "swift" VARCHAR(30),
    "branch" VARCHAR(100),
    "basic_salary" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bank_infos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" UUID NOT NULL,
    "employee_profile_id" UUID NOT NULL,
    "type" "DocumentType" NOT NULL DEFAULT 'NATIONAL_ID',
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignment_type" "TaskAssignmentType" NOT NULL DEFAULT 'SELF_OR_TEAM',
    "due_date" TIMESTAMPTZ(6),
    "order" INTEGER NOT NULL DEFAULT 0,
    "creator_id" UUID NOT NULL,
    "target_department_id" UUID,
    "assignee_id" UUID,
    "attachment_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "attachment_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "check_in_time" TIMESTAMPTZ(6) NOT NULL,
    "check_out_time" TIMESTAMPTZ(6),
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "delay_minutes" INTEGER NOT NULL DEFAULT 0,
    "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "total_days_requested" INTEGER NOT NULL,
    "type" "LeaveType" NOT NULL DEFAULT 'ANNUAL',
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_requests" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "start_time" VARCHAR(10),
    "end_time" VARCHAR(10),
    "hours_requested" INTEGER NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "permission_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "title" VARCHAR(150),
    "description" TEXT,
    "avatar_url" TEXT,
    "type" "ConversationType" NOT NULL DEFAULT 'DIRECT',
    "is_group" BOOLEAN NOT NULL DEFAULT false,
    "department_id" UUID,
    "creator_id" UUID,
    "last_message_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "employee_id" UUID,
    "role" "ParticipantRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_read_at" TIMESTAMPTZ(6),
    "is_muted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "sender_employee_id" UUID,
    "reply_to_id" UUID,
    "content" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "attachment_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reactions" JSONB DEFAULT '[]',
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_read_receipts" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_read_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "serial_number" VARCHAR(100) NOT NULL,
    "type" "AssetType" NOT NULL DEFAULT 'HARDWARE',
    "status" "AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "model" VARCHAR(100),
    "manufacturer" VARCHAR(100),
    "purchase_date" DATE,
    "purchase_cost" DECIMAL(12,2),
    "warranty_expiry" DATE,
    "notes" TEXT,
    "image_url" TEXT,
    "assignee_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_assignment_history" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returned_at" TIMESTAMPTZ(6),
    "condition_notes" TEXT,
    "assigned_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "asset_assignment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_transactions" (
    "id" UUID NOT NULL,
    "transaction_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(14,2) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "description" VARCHAR(255) NOT NULL,
    "reference_id" VARCHAR(100),
    "reference_type" VARCHAR(50),
    "attachment_url" TEXT,
    "is_reversed" BOOLEAN NOT NULL DEFAULT false,
    "reversed_at" TIMESTAMPTZ(6),
    "reversal_reason" TEXT,
    "reversed_by_id" UUID,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_profiles" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "base_salary" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "housing_allowance" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "transport_allowance" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "salary_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_cycles" (
    "id" UUID NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "PayrollCycleStatus" NOT NULL DEFAULT 'DRAFT',
    "total_gross" DECIMAL(14,2) NOT NULL DEFAULT 0.0,
    "total_net" DECIMAL(14,2) NOT NULL DEFAULT 0.0,
    "approved_at" TIMESTAMPTZ(6),
    "approved_by_id" UUID,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payroll_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "payroll_cycle_id" UUID NOT NULL,
    "base_salary" DECIMAL(12,2) NOT NULL,
    "gross_pay" DECIMAL(12,2) NOT NULL,
    "net_pay" DECIMAL(12,2) NOT NULL,
    "total_allowances" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "total_deductions" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "attendance_penalties" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_adjustments" (
    "id" UUID NOT NULL,
    "payslip_id" UUID NOT NULL,
    "type" "AdjustmentType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE INDEX "departments_code_idx" ON "departments"("code");

-- CreateIndex
CREATE INDEX "departments_head_id_idx" ON "departments"("head_id");

-- CreateIndex
CREATE INDEX "positions_department_id_idx" ON "positions"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "positions_department_id_name_key" ON "positions"("department_id", "name");

-- CreateIndex
CREATE INDEX "levels_position_id_idx" ON "levels"("position_id");

-- CreateIndex
CREATE UNIQUE INDEX "levels_position_id_name_key" ON "levels"("position_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "employee_profiles_user_id_key" ON "employee_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_profiles_employee_code_key" ON "employee_profiles"("employee_code");

-- CreateIndex
CREATE INDEX "employee_profiles_employee_code_idx" ON "employee_profiles"("employee_code");

-- CreateIndex
CREATE INDEX "employee_profiles_department_id_idx" ON "employee_profiles"("department_id");

-- CreateIndex
CREATE INDEX "employee_profiles_position_id_idx" ON "employee_profiles"("position_id");

-- CreateIndex
CREATE INDEX "employee_profiles_status_idx" ON "employee_profiles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_contacts_employee_profile_id_key" ON "emergency_contacts"("employee_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_infos_employee_profile_id_key" ON "bank_infos"("employee_profile_id");

-- CreateIndex
CREATE INDEX "employee_documents_employee_profile_id_idx" ON "employee_documents"("employee_profile_id");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_creator_id_idx" ON "tasks"("creator_id");

-- CreateIndex
CREATE INDEX "tasks_target_department_id_idx" ON "tasks"("target_department_id");

-- CreateIndex
CREATE INDEX "tasks_assignee_id_idx" ON "tasks"("assignee_id");

-- CreateIndex
CREATE INDEX "tasks_due_date_idx" ON "tasks"("due_date");

-- CreateIndex
CREATE INDEX "task_comments_task_id_idx" ON "task_comments"("task_id");

-- CreateIndex
CREATE INDEX "task_comments_author_id_idx" ON "task_comments"("author_id");

-- CreateIndex
CREATE INDEX "attendance_records_employee_id_idx" ON "attendance_records"("employee_id");

-- CreateIndex
CREATE INDEX "attendance_records_date_idx" ON "attendance_records"("date");

-- CreateIndex
CREATE INDEX "attendance_records_status_idx" ON "attendance_records"("status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_employee_id_date_key" ON "attendance_records"("employee_id", "date");

-- CreateIndex
CREATE INDEX "leave_requests_employee_id_idx" ON "leave_requests"("employee_id");

-- CreateIndex
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");

-- CreateIndex
CREATE INDEX "leave_requests_start_date_end_date_idx" ON "leave_requests"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "permission_requests_employee_id_idx" ON "permission_requests"("employee_id");

-- CreateIndex
CREATE INDEX "permission_requests_status_idx" ON "permission_requests"("status");

-- CreateIndex
CREATE INDEX "permission_requests_date_idx" ON "permission_requests"("date");

-- CreateIndex
CREATE INDEX "conversations_type_idx" ON "conversations"("type");

-- CreateIndex
CREATE INDEX "conversations_department_id_idx" ON "conversations"("department_id");

-- CreateIndex
CREATE INDEX "conversations_last_message_at_idx" ON "conversations"("last_message_at");

-- CreateIndex
CREATE INDEX "conversation_participants_user_id_idx" ON "conversation_participants"("user_id");

-- CreateIndex
CREATE INDEX "conversation_participants_employee_id_idx" ON "conversation_participants"("employee_id");

-- CreateIndex
CREATE INDEX "conversation_participants_conversation_id_idx" ON "conversation_participants"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversation_id_user_id_key" ON "conversation_participants"("conversation_id", "user_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_sender_id_idx" ON "messages"("sender_id");

-- CreateIndex
CREATE INDEX "messages_reply_to_id_idx" ON "messages"("reply_to_id");

-- CreateIndex
CREATE INDEX "message_read_receipts_message_id_idx" ON "message_read_receipts"("message_id");

-- CreateIndex
CREATE INDEX "message_read_receipts_user_id_idx" ON "message_read_receipts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_read_receipts_message_id_user_id_key" ON "message_read_receipts"("message_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "assets_serial_number_key" ON "assets"("serial_number");

-- CreateIndex
CREATE INDEX "assets_serial_number_idx" ON "assets"("serial_number");

-- CreateIndex
CREATE INDEX "assets_type_idx" ON "assets"("type");

-- CreateIndex
CREATE INDEX "assets_status_idx" ON "assets"("status");

-- CreateIndex
CREATE INDEX "assets_assignee_id_idx" ON "assets"("assignee_id");

-- CreateIndex
CREATE INDEX "asset_assignment_history_asset_id_idx" ON "asset_assignment_history"("asset_id");

-- CreateIndex
CREATE INDEX "asset_assignment_history_employee_id_idx" ON "asset_assignment_history"("employee_id");

-- CreateIndex
CREATE INDEX "asset_assignment_history_assigned_at_idx" ON "asset_assignment_history"("assigned_at");

-- CreateIndex
CREATE INDEX "asset_assignment_history_returned_at_idx" ON "asset_assignment_history"("returned_at");

-- CreateIndex
CREATE INDEX "financial_transactions_transaction_date_idx" ON "financial_transactions"("transaction_date");

-- CreateIndex
CREATE INDEX "financial_transactions_type_idx" ON "financial_transactions"("type");

-- CreateIndex
CREATE INDEX "financial_transactions_category_idx" ON "financial_transactions"("category");

-- CreateIndex
CREATE INDEX "financial_transactions_recorded_by_id_idx" ON "financial_transactions"("recorded_by_id");

-- CreateIndex
CREATE INDEX "financial_transactions_reference_id_idx" ON "financial_transactions"("reference_id");

-- CreateIndex
CREATE INDEX "financial_transactions_is_reversed_idx" ON "financial_transactions"("is_reversed");

-- CreateIndex
CREATE UNIQUE INDEX "salary_profiles_employee_id_key" ON "salary_profiles"("employee_id");

-- CreateIndex
CREATE INDEX "payroll_cycles_status_idx" ON "payroll_cycles"("status");

-- CreateIndex
CREATE INDEX "payroll_cycles_year_month_idx" ON "payroll_cycles"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_cycles_year_month_key" ON "payroll_cycles"("year", "month");

-- CreateIndex
CREATE INDEX "payslips_employee_id_idx" ON "payslips"("employee_id");

-- CreateIndex
CREATE INDEX "payslips_payroll_cycle_id_idx" ON "payslips"("payroll_cycle_id");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_employee_id_payroll_cycle_id_key" ON "payslips"("employee_id", "payroll_cycle_id");

-- CreateIndex
CREATE INDEX "financial_adjustments_payslip_id_idx" ON "financial_adjustments"("payslip_id");

-- CreateIndex
CREATE INDEX "financial_adjustments_type_idx" ON "financial_adjustments"("type");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_head_id_fkey" FOREIGN KEY ("head_id") REFERENCES "employee_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "levels" ADD CONSTRAINT "levels_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_employee_profile_id_fkey" FOREIGN KEY ("employee_profile_id") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_infos" ADD CONSTRAINT "bank_infos_employee_profile_id_fkey" FOREIGN KEY ("employee_profile_id") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_profile_id_fkey" FOREIGN KEY ("employee_profile_id") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "employee_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_target_department_id_fkey" FOREIGN KEY ("target_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "employee_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "employee_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_requests" ADD CONSTRAINT "permission_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_employee_id_fkey" FOREIGN KEY ("sender_employee_id") REFERENCES "employee_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_read_receipts" ADD CONSTRAINT "message_read_receipts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_read_receipts" ADD CONSTRAINT "message_read_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "employee_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignment_history" ADD CONSTRAINT "asset_assignment_history_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignment_history" ADD CONSTRAINT "asset_assignment_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignment_history" ADD CONSTRAINT "asset_assignment_history_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "employee_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_reversed_by_id_fkey" FOREIGN KEY ("reversed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_profiles" ADD CONSTRAINT "salary_profiles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_cycles" ADD CONSTRAINT "payroll_cycles_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_cycle_id_fkey" FOREIGN KEY ("payroll_cycle_id") REFERENCES "payroll_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_adjustments" ADD CONSTRAINT "financial_adjustments_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

