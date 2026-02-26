import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { BudgetKind } from '@prisma/client';

export class CreateBudgetDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(1900)
  year: number;

  @IsEnum(BudgetKind)
  @IsOptional()
  kind?: BudgetKind;

  @IsString()
  @IsOptional()
  notes?: string;
}
