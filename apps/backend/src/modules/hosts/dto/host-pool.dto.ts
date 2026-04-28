import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class UpsertHostPoolDto {
  @IsString()
  @Matches(/^[A-Z0-9_:]{1,32}$/, {
    message: 'tag must be 1-32 chars of A-Z, 0-9, underscore or colon',
  })
  tag!: string;

  @IsArray()
  @ArrayMinSize(0)
  @IsString({ each: true })
  addresses!: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  currentIdx?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65_535)
  port?: number | null;

  @IsOptional()
  @IsString()
  note?: string | null;
}

export class RotatePoolDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  toIdx?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
