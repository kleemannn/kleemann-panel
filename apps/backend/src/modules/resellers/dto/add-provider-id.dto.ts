import { IsOptional, IsString, MinLength } from 'class-validator';

export class AddProviderIdDto {
  @IsString()
  @MinLength(1)
  providerId!: string;

  @IsOptional()
  @IsString()
  label?: string;
}
