-- CreateTable
CREATE TABLE "time_studies" (
    "id" TEXT NOT NULL,
    "operation_type" TEXT NOT NULL,
    "operation_name" TEXT,
    "baseline_manual_minutes" INTEGER NOT NULL,
    "actual_minutes" DOUBLE PRECISION NOT NULL,
    "minutes_saved" DOUBLE PRECISION NOT NULL,
    "percent_reduction" DOUBLE PRECISION NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_studies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_studies_company_id_idx" ON "time_studies"("company_id");

-- CreateIndex
CREATE INDEX "time_studies_user_id_idx" ON "time_studies"("user_id");

-- CreateIndex
CREATE INDEX "time_studies_operation_type_idx" ON "time_studies"("operation_type");

-- CreateIndex
CREATE INDEX "time_studies_created_at_idx" ON "time_studies"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "time_studies" ADD CONSTRAINT "time_studies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_studies" ADD CONSTRAINT "time_studies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
