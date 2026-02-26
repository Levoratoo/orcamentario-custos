import { IsArray, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class CopyFromMonthDto {
  @IsInt()
  @Min(1)
  @Max(12)
  fromMonth: number;

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
