import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateBudgetItemDto {
  @IsOptional()
  @IsString()
  itemName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isReimbursement?: boolean;

  @IsOptional()
  @IsString()
  comment?: string | null;
}
