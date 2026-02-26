import { ApiProperty } from '@nestjs/swagger';

export class ImportAccountPlanResultDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  inserted: number;

  @ApiProperty()
  updated: number;

  @ApiProperty({ type: [Object] })
  errors: Array<{ line: number; code?: string; message: string }>;
}
