import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateSponsorDto {
  @IsOptional()
  @IsString()
  accountCode?: string;

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
