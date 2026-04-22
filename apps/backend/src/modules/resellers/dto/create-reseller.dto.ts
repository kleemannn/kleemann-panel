import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { ResellerType } from '@prisma/client';

export class CreateResellerDto {
  @IsString()
  @Matches(/^\d+$/, { message: 'telegramId must be a numeric string' })
  telegramId!: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsEnum(ResellerType)
  type!: ResellerType;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  maxClients!: number;

  // ISO date string; empty/undefined => no expiration
  @IsOptional()
  @IsString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Optional short tag used by Remnawave to attribute remote users to
  // this reseller. Uppercase letters, digits and underscore, max 16.
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9_]{1,16}$/, {
    message: 'tag must be 1-16 chars of A-Z, 0-9 or underscore',
  })
  tag?: string;
}
