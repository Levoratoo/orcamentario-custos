import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(6)
  newPassword?: string;
}
