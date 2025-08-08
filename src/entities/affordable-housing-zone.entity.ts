import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('affordable_housing_zone')
export class AffordableHousingZone {
  @PrimaryGeneratedColumn()
  land_tract_id: number;

  @Column({ type: 'integer', nullable: true })
  zipcode: number;
}
