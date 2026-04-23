import { IsDateString, IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';

export class ExtendClientDto {
  @ValidateIf((o: ExtendClientDto) => o.expiresAt === undefined || o.expiresAt === null)
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays?: number;

  // Absolute ISO date (UTC). When provided, overrides durationDays and sets
  // the new expiry to exactly this timestamp.
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
