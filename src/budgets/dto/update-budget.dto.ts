import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { BudgetKind, BudgetStatus } from '@prisma/client';

export class UpdateBudgetDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsInt()
  @Min(1900)
  @IsOptional()
  year?: number;

  @IsEnum(BudgetKind)
  @IsOptional()
  kind?: BudgetKind;

  @IsEnum(BudgetStatus)
  @IsOptional()
  status?: BudgetStatus;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
