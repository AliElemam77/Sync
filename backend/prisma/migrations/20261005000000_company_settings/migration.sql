-- CreateTable
CREATE TABLE "company_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "overtime_enabled" BOOLEAN NOT NULL DEFAULT false,
    "overtime_multiplier" DECIMAL(4,2) NOT NULL DEFAULT 2,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

