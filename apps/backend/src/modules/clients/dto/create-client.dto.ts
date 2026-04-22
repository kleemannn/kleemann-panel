import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateClientDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]{3,32}$/, {
    message:
      'username must be 3-32 chars, only letters, digits, underscore, dot or dash',
  })
  username!: string;

  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays!: number;

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
}
