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
}
