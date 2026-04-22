import { IsInt, Max, Min } from 'class-validator';

export class ExtendClientDto {
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays!: number;
}
