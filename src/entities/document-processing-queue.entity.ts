import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Client } from './client.entity';
import { FinancialDocuments } from './financial-documents.entity';

export enum QueueStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRY = 'retry'
}

@Entity('document_processing_queue')
export class DocumentProcessingQueue {
  @PrimaryGeneratedColumn()
  queue_id: number;

  @Column({ type: 'integer' })
  document_id: number;

  @ManyToOne(() => FinancialDocuments)
  @JoinColumn({ name: 'document_id' })
  document: FinancialDocuments;

  @Column({ type: 'text' })
  customer_id: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'customer_id' })
  customer: Client;

  @Column({ type: 'integer', default: 5 })
  priority: number; // 1-10 (1 = highest priority)

  @Column({ type: 'integer', default: 0 })
  processing_attempts: number;

  @Column({
    type: 'enum',
    enum: QueueStatus,
    default: QueueStatus.QUEUED
  })
  status: QueueStatus;

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  scheduled_time: Date;

  @Column({ type: 'timestamp', nullable: true })
  started_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
