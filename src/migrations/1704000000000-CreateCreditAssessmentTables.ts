import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCreditAssessmentTables1704000000000 implements MigrationInterface {
  name = 'CreateCreditAssessmentTables1704000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create financial_documents table
    await queryRunner.query(`
      CREATE TABLE "financial_documents" (
        "document_id" SERIAL NOT NULL,
        "customer_id" text NOT NULL,
        "document_type" character varying NOT NULL 
          CHECK (document_type IN ('bank_statement', 'mpesa_statement', 'sacco_statement', 'payslip', 'business_registration', 'title_deed')),
        "document_data" jsonb NOT NULL,
        "file_path" text,
        "upload_date" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "processing_status" character varying NOT NULL DEFAULT 'pending'
          CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
        "extracted_data" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_financial_documents" PRIMARY KEY ("document_id"),
        CONSTRAINT "FK_financial_documents_customer" FOREIGN KEY ("customer_id") REFERENCES "clients"("customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // Create transaction_history table
    await queryRunner.query(`
      CREATE TABLE "transaction_history" (
        "transaction_id" SERIAL NOT NULL,
        "customer_id" text NOT NULL,
        "source_type" character varying NOT NULL
          CHECK (source_type IN ('bank', 'mpesa', 'sacco', 'cash', 'other')),
        "transaction_date" date NOT NULL,
        "transaction_type" character varying NOT NULL
          CHECK (transaction_type IN ('income', 'expense', 'transfer', 'payment', 'withdrawal', 'deposit')),
        "amount" numeric(12,2) NOT NULL,
        "description" text,
        "category" text NOT NULL,
        "subcategory" text,
        "merchant" text,
        "account_type" text,
        "reference_number" text,
        "balance_after" numeric(12,2),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_transaction_history" PRIMARY KEY ("transaction_id"),
        CONSTRAINT "FK_transaction_history_customer" FOREIGN KEY ("customer_id") REFERENCES "clients"("customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // Create kenyan_credit_factors table
    await queryRunner.query(`
      CREATE TABLE "kenyan_credit_factors" (
        "factor_id" SERIAL NOT NULL,
        "customer_id" text NOT NULL,
        "mpesa_balance_avg" numeric(10,2),
        "mpesa_transactions_monthly" integer,
        "mpesa_utility_payments_count" integer,
        "mpesa_merchant_payments_count" integer,
        "mpesa_payment_consistency_score" integer CHECK (mpesa_payment_consistency_score BETWEEN 1 AND 100),
        "sacco_membership_duration_months" integer,
        "sacco_monthly_contribution_avg" numeric(10,2),
        "sacco_loan_repayment_score" integer CHECK (sacco_loan_repayment_score BETWEEN 1 AND 100),
        "chama_participation_count" integer,
        "chama_contribution_consistency" boolean,
        "employment_stability_score" integer CHECK (employment_stability_score BETWEEN 1 AND 100),
        "employment_duration_months" integer,
        "business_registration_status" character varying 
          CHECK (business_registration_status IN ('registered', 'unregistered', 'pending', 'not_applicable')),
        "annual_revenue" numeric(12,2),
        "income_consistency_score" integer CHECK (income_consistency_score BETWEEN 1 AND 100),
        "land_ownership_value" numeric(12,2),
        "rental_payment_history_score" integer CHECK (rental_payment_history_score BETWEEN 1 AND 100),
        "vehicle_ownership_value" numeric(10,2),
        "asset_diversification_score" integer CHECK (asset_diversification_score BETWEEN 1 AND 100),
        "community_reference_score" integer CHECK (community_reference_score BETWEEN 1 AND 100),
        "family_financial_support_available" boolean,
        "community_trust_score" integer CHECK (community_trust_score BETWEEN 1 AND 100),
        "nhif_status" character varying 
          CHECK (nhif_status IN ('active', 'inactive', 'pending', 'not_applicable')),
        "nhif_contribution_consistency" boolean,
        "health_insurance_coverage" numeric(10,2),
        "health_insurance_score" integer CHECK (health_insurance_score BETWEEN 1 AND 100),
        "digital_payment_adoption_score" integer CHECK (digital_payment_adoption_score BETWEEN 1 AND 100),
        "online_business_presence" boolean,
        "social_media_business_activity" boolean,
        "overall_credit_score" integer CHECK (overall_credit_score BETWEEN 300 AND 850),
        "risk_level" character varying CHECK (risk_level IN ('low', 'medium', 'high', 'very_high')),
        "confidence_score" integer CHECK (confidence_score BETWEEN 1 AND 100),
        "assessment_date" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "last_updated" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_kenyan_credit_factors" PRIMARY KEY ("factor_id"),
        CONSTRAINT "FK_kenyan_credit_factors_customer" FOREIGN KEY ("customer_id") REFERENCES "clients"("customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "UQ_kenyan_credit_factors_customer" UNIQUE ("customer_id")
      )
    `);

    // Create credit_assessments table
    await queryRunner.query(`
      CREATE TABLE "credit_assessments" (
        "assessment_id" SERIAL NOT NULL,
        "customer_id" text NOT NULL,
        "assessment_date" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "credit_score" integer CHECK (credit_score BETWEEN 300 AND 850),
        "risk_level" character varying CHECK (risk_level IN ('low', 'medium', 'high', 'very_high')),
        "payment_history_score" integer CHECK (payment_history_score BETWEEN 1 AND 100),
        "debt_utilization_score" integer CHECK (debt_utilization_score BETWEEN 1 AND 100),
        "income_stability_score" integer CHECK (income_stability_score BETWEEN 1 AND 100),
        "account_mix_score" integer CHECK (account_mix_score BETWEEN 1 AND 100),
        "new_credit_score" integer CHECK (new_credit_score BETWEEN 1 AND 100),
        "mpesa_score" integer CHECK (mpesa_score BETWEEN 1 AND 100),
        "sacco_score" integer CHECK (sacco_score BETWEEN 1 AND 100),
        "community_score" integer CHECK (community_score BETWEEN 1 AND 100),
        "employment_score" integer CHECK (employment_score BETWEEN 1 AND 100),
        "factors" jsonb,
        "risk_indicators" text[],
        "recommendations" text[],
        "confidence_level" integer CHECK (confidence_level BETWEEN 1 AND 100),
        "data_sources_used" text[],
        "assessment_method" character varying NOT NULL DEFAULT 'automated'
          CHECK (assessment_method IN ('automated', 'manual', 'hybrid')),
        "reviewer_id" text,
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_credit_assessments" PRIMARY KEY ("assessment_id"),
        CONSTRAINT "FK_credit_assessments_customer" FOREIGN KEY ("customer_id") REFERENCES "clients"("customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // Create customer_references table
    await queryRunner.query(`
      CREATE TABLE "customer_references" (
        "reference_id" SERIAL NOT NULL,
        "customer_id" text NOT NULL,
        "reference_type" character varying NOT NULL
          CHECK (reference_type IN ('family', 'community', 'employer', 'landlord', 'business_partner')),
        "reference_name" text NOT NULL,
        "relationship" text,
        "contact_number" text,
        "contact_email" text,
        "verification_status" character varying NOT NULL DEFAULT 'pending'
          CHECK (verification_status IN ('pending', 'verified', 'failed', 'unreachable')),
        "verification_date" TIMESTAMP,
        "verification_notes" text,
        "trustworthiness_score" integer CHECK (trustworthiness_score BETWEEN 1 AND 100),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_customer_references" PRIMARY KEY ("reference_id"),
        CONSTRAINT "FK_customer_references_customer" FOREIGN KEY ("customer_id") REFERENCES "clients"("customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // Create document_processing_queue table
    await queryRunner.query(`
      CREATE TABLE "document_processing_queue" (
        "queue_id" SERIAL NOT NULL,
        "document_id" integer NOT NULL,
        "customer_id" text NOT NULL,
        "priority" integer NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
        "processing_attempts" integer NOT NULL DEFAULT 0,
        "status" character varying NOT NULL DEFAULT 'queued'
          CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'retry')),
        "error_message" text,
        "scheduled_time" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "started_at" TIMESTAMP,
        "completed_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_document_processing_queue" PRIMARY KEY ("queue_id"),
        CONSTRAINT "FK_document_processing_queue_document" FOREIGN KEY ("document_id") REFERENCES "financial_documents"("document_id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_document_processing_queue_customer" FOREIGN KEY ("customer_id") REFERENCES "clients"("customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // Create indexes for better performance
    await queryRunner.query(`CREATE INDEX "IDX_financial_documents_customer" ON "financial_documents" ("customer_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_financial_documents_type" ON "financial_documents" ("document_type")`);
    await queryRunner.query(`CREATE INDEX "IDX_financial_documents_status" ON "financial_documents" ("processing_status")`);
    
    await queryRunner.query(`CREATE INDEX "IDX_transaction_history_customer" ON "transaction_history" ("customer_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_transaction_history_date" ON "transaction_history" ("transaction_date")`);
    await queryRunner.query(`CREATE INDEX "IDX_transaction_history_type" ON "transaction_history" ("transaction_type")`);
    await queryRunner.query(`CREATE INDEX "IDX_transaction_history_source" ON "transaction_history" ("source_type")`);
    
    await queryRunner.query(`CREATE INDEX "IDX_credit_assessments_customer" ON "credit_assessments" ("customer_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_credit_assessments_date" ON "credit_assessments" ("assessment_date")`);
    await queryRunner.query(`CREATE INDEX "IDX_credit_assessments_score" ON "credit_assessments" ("credit_score")`);
    
    await queryRunner.query(`CREATE INDEX "IDX_customer_references_customer" ON "customer_references" ("customer_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_customer_references_type" ON "customer_references" ("reference_type")`);
    
    await queryRunner.query(`CREATE INDEX "IDX_processing_queue_status" ON "document_processing_queue" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_processing_queue_priority" ON "document_processing_queue" ("priority")`);
    await queryRunner.query(`CREATE INDEX "IDX_processing_queue_customer" ON "document_processing_queue" ("customer_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_processing_queue_customer"`);
    await queryRunner.query(`DROP INDEX "IDX_processing_queue_priority"`);
    await queryRunner.query(`DROP INDEX "IDX_processing_queue_status"`);
    await queryRunner.query(`DROP INDEX "IDX_customer_references_type"`);
    await queryRunner.query(`DROP INDEX "IDX_customer_references_customer"`);
    await queryRunner.query(`DROP INDEX "IDX_credit_assessments_score"`);
    await queryRunner.query(`DROP INDEX "IDX_credit_assessments_date"`);
    await queryRunner.query(`DROP INDEX "IDX_credit_assessments_customer"`);
    await queryRunner.query(`DROP INDEX "IDX_transaction_history_source"`);
    await queryRunner.query(`DROP INDEX "IDX_transaction_history_type"`);
    await queryRunner.query(`DROP INDEX "IDX_transaction_history_date"`);
    await queryRunner.query(`DROP INDEX "IDX_transaction_history_customer"`);
    await queryRunner.query(`DROP INDEX "IDX_financial_documents_status"`);
    await queryRunner.query(`DROP INDEX "IDX_financial_documents_type"`);
    await queryRunner.query(`DROP INDEX "IDX_financial_documents_customer"`);

    // Drop tables in reverse order (considering foreign key constraints)
    await queryRunner.query(`DROP TABLE "document_processing_queue"`);
    await queryRunner.query(`DROP TABLE "customer_references"`);
    await queryRunner.query(`DROP TABLE "credit_assessments"`);
    await queryRunner.query(`DROP TABLE "kenyan_credit_factors"`);
    await queryRunner.query(`DROP TABLE "transaction_history"`);
    await queryRunner.query(`DROP TABLE "financial_documents"`);
  }
}
