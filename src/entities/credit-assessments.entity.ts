import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Client } from './client.entity';

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

export enum AssessmentMethod {
  AUTOMATED = 'automated',
  MANUAL = 'manual',
  HYBRID = 'hybrid'
}

@Entity('credit_assessments')
export class CreditAssessments {
  @PrimaryGeneratedColumn()
  assessment_id: number;

  @Column({ type: 'text' })
  customer_id: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'customer_id' })
  customer: Client;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  assessment_date: Date;

  // Raw Scores
  @Column({ type: 'integer', nullable: true })
  credit_score: number; // 300-850

  @Column({
    type: 'enum',
    enum: RiskLevel,
    nullable: true
  })
  risk_level: RiskLevel;

  // Detailed Breakdown
  @Column({ type: 'integer', nullable: true })
  payment_history_score: number; // 1-100

  @Column({ type: 'integer', nullable: true })
  debt_utilization_score: number; // 1-100

  @Column({ type: 'integer', nullable: true })
  income_stability_score: number; // 1-100

  @Column({ type: 'integer', nullable: true })
  account_mix_score: number; // 1-100

  @Column({ type: 'integer', nullable: true })
  new_credit_score: number; // 1-100

  // Kenyan-Specific Factors
  @Column({ type: 'integer', nullable: true })
  mpesa_score: number; // 1-100

  @Column({ type: 'integer', nullable: true })
  sacco_score: number; // 1-100

  @Column({ type: 'integer', nullable: true })
  community_score: number; // 1-100

  @Column({ type: 'integer', nullable: true })
  employment_score: number; // 1-100

  // Analysis Results
  @Column({ type: 'jsonb', nullable: true })
  factors: any; // Detailed scoring factors

  @Column({ type: 'text', array: true, nullable: true })
  risk_indicators: string[]; // Array of risk factors

  @Column({ type: 'text', array: true, nullable: true })
  recommendations: string[]; // Array of improvement suggestions

  @Column({ type: 'integer', nullable: true })
  confidence_level: number; // 1-100

  // Metadata
  @Column({ type: 'text', array: true, nullable: true })
  data_sources_used: string[];

  @Column({
    type: 'enum',
    enum: AssessmentMethod,
    default: AssessmentMethod.AUTOMATED
  })
  assessment_method: AssessmentMethod;

  @Column({ type: 'text', nullable: true })
  reviewer_id: string; // For manual reviews

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  created_at: Date;
}
