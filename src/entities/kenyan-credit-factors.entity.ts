import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Client } from './client.entity';

export enum BusinessRegistrationStatus {
  REGISTERED = 'registered',
  UNREGISTERED = 'unregistered',
  PENDING = 'pending',
  NOT_APPLICABLE = 'not_applicable'
}

export enum NhifStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  NOT_APPLICABLE = 'not_applicable'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

@Entity('kenyan_credit_factors')
export class KenyanCreditFactors {
  @PrimaryGeneratedColumn()
  factor_id: number;

  @Column({ type: 'text' })
  customer_id: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'customer_id' })
  customer: Client;

  // M-Pesa & Mobile Money Metrics
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  mpesa_balance_avg: number;

  @Column({ type: 'integer', nullable: true })
  mpesa_transactions_monthly: number;

  @Column({ type: 'integer', nullable: true })
  mpesa_utility_payments_count: number;

  @Column({ type: 'integer', nullable: true })
  mpesa_merchant_payments_count: number;

  @Column({ type: 'integer', nullable: true })
  mpesa_payment_consistency_score: number; // 1-100

  // SACCO & Chama Metrics
  @Column({ type: 'integer', nullable: true })
  sacco_membership_duration_months: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  sacco_monthly_contribution_avg: number;

  @Column({ type: 'integer', nullable: true })
  sacco_loan_repayment_score: number; // 1-100

  @Column({ type: 'integer', nullable: true })
  chama_participation_count: number;

  @Column({ type: 'boolean', nullable: true })
  chama_contribution_consistency: boolean;

  // Employment & Business Metrics
  @Column({ type: 'integer', nullable: true })
  employment_stability_score: number; // 1-100

  @Column({ type: 'integer', nullable: true })
  employment_duration_months: number;

  @Column({
    type: 'enum',
    enum: BusinessRegistrationStatus,
    nullable: true
  })
  business_registration_status: BusinessRegistrationStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  annual_revenue: number;

  @Column({ type: 'integer', nullable: true })
  income_consistency_score: number; // 1-100

  // Property & Assets Metrics
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  land_ownership_value: number;

  @Column({ type: 'integer', nullable: true })
  rental_payment_history_score: number; // 1-100

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  vehicle_ownership_value: number;

  @Column({ type: 'integer', nullable: true })
  asset_diversification_score: number; // 1-100

  // Community & Reference Metrics
  @Column({ type: 'integer', nullable: true })
  community_reference_score: number; // 1-100

  @Column({ type: 'boolean', nullable: true })
  family_financial_support_available: boolean;

  @Column({ type: 'integer', nullable: true })
  community_trust_score: number; // 1-100

  // Health & Insurance Metrics
  @Column({
    type: 'enum',
    enum: NhifStatus,
    nullable: true
  })
  nhif_status: NhifStatus;

  @Column({ type: 'boolean', nullable: true })
  nhif_contribution_consistency: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  health_insurance_coverage: number;

  @Column({ type: 'integer', nullable: true })
  health_insurance_score: number; // 1-100

  // Digital & Social Metrics
  @Column({ type: 'integer', nullable: true })
  digital_payment_adoption_score: number; // 1-100

  @Column({ type: 'boolean', nullable: true })
  online_business_presence: boolean;

  @Column({ type: 'boolean', nullable: true })
  social_media_business_activity: boolean;

  // Calculated Scores
  @Column({ type: 'integer', nullable: true })
  overall_credit_score: number; // 300-850

  @Column({
    type: 'enum',
    enum: RiskLevel,
    nullable: true
  })
  risk_level: RiskLevel;

  @Column({ type: 'integer', nullable: true })
  confidence_score: number; // 1-100

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  assessment_date: Date;

  @UpdateDateColumn()
  last_updated: Date;

  @CreateDateColumn()
  created_at: Date;
}
