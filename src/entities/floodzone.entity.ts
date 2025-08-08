import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('floodzone')
export class Floodzone {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'jsonb', nullable: true })
  geometry: any;

  @Column({ type: 'text', nullable: true })
  descr: string;
}
