import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ResellerType } from '@prisma/client';

export class UpsertSquadDto {
  @IsEnum(ResellerType)
  type!: ResellerType;

  @IsString()
  @MinLength(1)
  squadUuid!: string;

  @IsOptional()
  @IsString()
  label?: string;
}
