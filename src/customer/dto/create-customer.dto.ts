import { IsString, IsOptional, IsNumber, Min, Max, IsIn } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  customer_id: string;

  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsNumber()
  @IsOptional()
  zip_code?: number;

  @IsNumber()
  @Min(18)
  @Max(120)
  @IsOptional()
  age?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  income?: number;

  @IsString()
  @IsIn(['yes', 'no'])
  @IsOptional()
  veteran?: string;
}
