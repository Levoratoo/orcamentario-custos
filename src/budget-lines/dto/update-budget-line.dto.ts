import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DriverType } from '@prisma/client';

export class UpdateBudgetLineDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: DriverType, required: false })
  @IsOptional()
  @IsEnum(DriverType)
  driverType?: DriverType;

  @ApiProperty({ required: false })
  @IsOptional()
  driverValue?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  monthlyValues?: Record<string, string>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  assumptions?: string;
}
