import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  trafficLimitGb?: number | null;
}
