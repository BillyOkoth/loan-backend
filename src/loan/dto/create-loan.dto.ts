import { IsString, IsNumber, IsPositive, Min, Max } from 'class-validator';

export class CreateLoanDto {
  @IsString()
  customerId: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  interestRate: number;

  @IsNumber()
  @IsPositive()
  @Min(1)
  @Max(360) // 30 years max
  term: number;

  @IsString()
  purpose: string;
}
