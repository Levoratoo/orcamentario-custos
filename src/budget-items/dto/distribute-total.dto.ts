import { IsArray, IsIn, IsNumber, IsOptional } from 'class-validator';

export class DistributeTotalDto {
  @IsNumber()
  annualTotal: number;

  @IsIn(['EQUAL', 'CUSTOM'])
  strategy: 'EQUAL' | 'CUSTOM';

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  weights?: number[];
}
