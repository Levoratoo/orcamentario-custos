import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SetOwnerDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ownerCoordinatorId?: string;
}
