import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateBudgetItemDto {
  @IsUUID()
  budgetId: string;

  @IsString()
  @IsNotEmpty()
  accountCode: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string | null;

  @IsString()
  @IsNotEmpty()
  itemName: string;

  @IsOptional()
  @IsBoolean()
  isReimbursement?: boolean;

  @IsOptional()
  @IsString()
  comment?: string;
}
