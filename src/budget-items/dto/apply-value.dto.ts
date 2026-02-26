import { IsArray, IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class ApplyValueDto {
  @IsNumber()
  value: number;

  @IsOptional()
  @IsIn(['ALL'])
  months?: 'ALL';

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(12, { each: true })
  monthList?: number[];
}
