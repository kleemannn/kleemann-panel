import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateClientDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]{3,32}$/, {
    message:
      'username must be 3-32 chars, only letters, digits, underscore, dot or dash',
  })
  username!: string;

  @ValidateIf((o: CreateClientDto) => o.expiresAt === undefined || o.expiresAt === null)
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays?: number;

  // Absolute ISO date. When provided, overrides durationDays.
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  // null / undefined => unlimited
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  trafficLimitGb?: number;

  @IsOptional()
  @IsString()
  @MinLength(0)
  note?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'clientTelegramId must be a numeric string' })
  clientTelegramId?: string;

  // 0 = unlimited, default 1
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  hwidDeviceLimit?: number;
}
