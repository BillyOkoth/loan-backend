import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Client } from './client.entity';

export enum DocumentType {
  BANK_STATEMENT = 'bank_statement',
  MPESA_STATEMENT = 'mpesa_statement',
  SACCO_STATEMENT = 'sacco_statement',
  PAYSLIP = 'payslip',
  BUSINESS_REGISTRATION = 'business_registration',
  TITLE_DEED = 'title_deed'
}

export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

@Entity('financial_documents')
export class FinancialDocuments {
  @PrimaryGeneratedColumn()
  document_id: number;

  @Column({ type: 'text' })
  customer_id: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'customer_id' })
  customer: Client;

  @Column({
    type: 'enum',
    enum: DocumentType
  })
  document_type: DocumentType;

  @Column({ type: 'jsonb' })
  document_data: any;

  @Column({ type: 'text', nullable: true })
  file_path: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  upload_date: Date;

  @Column({
    type: 'enum',
    enum: ProcessingStatus,
    default: ProcessingStatus.PENDING
  })
  processing_status: ProcessingStatus;

  @Column({ type: 'jsonb', nullable: true })
  extracted_data: any;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
