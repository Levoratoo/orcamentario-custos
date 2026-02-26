import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DriverType } from '@prisma/client';

export class CreateBudgetLineDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  scenarioId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  costCenterId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ enum: DriverType })
  @IsEnum(DriverType)
  driverType: DriverType;

  @ApiProperty({ required: false })
  @IsOptional()
  driverValue?: any;

  @ApiProperty()
  @IsNotEmpty()
  monthlyValues: Record<string, string>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  assumptions?: string;
}
