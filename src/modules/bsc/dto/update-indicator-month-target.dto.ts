import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min, ValidateIf } from 'class-validator';

export class UpdateIndicatorMonthTargetDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsNumber()
  targetValue?: number | null;
}
