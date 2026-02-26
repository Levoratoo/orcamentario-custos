import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNumber, Max, Min, ValidateNested } from 'class-validator';

class BudgetItemValueInput {
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsNumber()
  value: number;
}

export class UpdateBudgetItemValuesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BudgetItemValueInput)
  values: BudgetItemValueInput[];
}
