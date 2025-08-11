import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Client } from './client.entity';

export enum ReferenceType {
  FAMILY = 'family',
  COMMUNITY = 'community',
  EMPLOYER = 'employer',
  LANDLORD = 'landlord',
  BUSINESS_PARTNER = 'business_partner'
}

export enum VerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  FAILED = 'failed',
  UNREACHABLE = 'unreachable'
}

@Entity('customer_references')
export class CustomerReferences {
  @PrimaryGeneratedColumn()
  reference_id: number;

  @Column({ type: 'text' })
  customer_id: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'customer_id' })
  customer: Client;

  @Column({
    type: 'enum',
    enum: ReferenceType
  })
  reference_type: ReferenceType;

  @Column({ type: 'text' })
  reference_name: string;

  @Column({ type: 'text', nullable: true })
  relationship: string;

  @Column({ type: 'text', nullable: true })
  contact_number: string;

  @Column({ type: 'text', nullable: true })
  contact_email: string;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING
  })
  verification_status: VerificationStatus;

  @Column({ type: 'timestamp', nullable: true })
  verification_date: Date;

  @Column({ type: 'text', nullable: true })
  verification_notes: string;

  @Column({ type: 'integer', nullable: true })
  trustworthiness_score: number; // 1-100

  @CreateDateColumn()
  created_at: Date;
}
