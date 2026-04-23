import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { ResellerType } from '@prisma/client';

export class UpdateResellerDto {
  @IsOptional()
  @IsEnum(ResellerType)
  type?: ResellerType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  maxClients?: number;

  @IsOptional()
  @IsString()
  expiresAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Pass "" or null to clear the tag.
  @IsOptional()
  @IsString()
  @Matches(/^([A-Z0-9_]{1,16})?$/, {
    message: 'tag must be 1-16 chars of A-Z, 0-9 or underscore (or empty to clear)',
  })
  tag?: string | null;

  // Pass "" or null to clear.
  @IsOptional()
  @IsString()
  providerId?: string | null;
}
