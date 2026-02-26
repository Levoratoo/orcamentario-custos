import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { DriverType } from '@prisma/client';
import { Type } from 'class-transformer';

export class BulkUpsertItemDto {
  @ApiProperty()
  @IsString()
  costCenterCode: string;

  @ApiProperty()
  @IsString()
  accountCode: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ enum: DriverType })
  @IsEnum(DriverType)
  driverType: DriverType;

  @ApiProperty({ required: false })
  driverValue?: any;

  @ApiProperty({ required: false })
  @IsString()
  assumptions?: string;

  @ApiProperty()
  monthlyValues: Record<string, string>;
}

export class BulkUpsertDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  scenarioId: string;

  @ApiProperty({ type: [BulkUpsertItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUpsertItemDto)
  items: BulkUpsertItemDto[];
}
