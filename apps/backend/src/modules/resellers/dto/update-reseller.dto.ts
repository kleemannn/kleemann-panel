import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
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
}
