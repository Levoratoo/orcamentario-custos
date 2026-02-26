import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateSponsorDto {
  @IsString()
  @IsNotEmpty()
  accountCode: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string | null;

  @IsOptional()
  @IsUUID()
  sponsorUserId?: string | null;

  @IsOptional()
  @IsString()
  sponsorDisplay?: string;
}
