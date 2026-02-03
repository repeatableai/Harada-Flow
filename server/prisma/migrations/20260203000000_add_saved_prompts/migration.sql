-- CreateTable
CREATE TABLE "saved_prompts" (
    "id" TEXT NOT NULL,
    "deliverable_name" TEXT NOT NULL,
    "deliverable_type" TEXT NOT NULL,
    "column_name" TEXT,
    "overview" TEXT NOT NULL,
    "prompts" JSONB NOT NULL,
    "company_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_prompts_company_id_idx" ON "saved_prompts"("company_id");

-- CreateIndex
CREATE INDEX "saved_prompts_created_at_idx" ON "saved_prompts"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "saved_prompts" ADD CONSTRAINT "saved_prompts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
