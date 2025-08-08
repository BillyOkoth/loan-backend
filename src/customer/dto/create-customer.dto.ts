import { IsString, IsEmail, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  phone: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(850)
  creditScore?: number;
}
