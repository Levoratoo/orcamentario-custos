import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class FinalizePlanningDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  proacaoId: string;

  @ApiProperty()
  @IsInt()
  year: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  userId?: string;
}
