import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('loan_chunk')
export class LoanChunk {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', nullable: true })
  customer_id: string;

  @Column({ type: 'integer', nullable: true })
  chunk_id: number;

  @Column({ type: 'text', nullable: true })
  chunk_text: string;

  @Column({ type: 'text', nullable: true })
  chunk_vector: string; // Store as JSON string for compatibility
}
