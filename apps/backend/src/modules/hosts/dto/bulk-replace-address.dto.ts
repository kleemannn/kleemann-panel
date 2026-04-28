import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class BulkReplaceAddressDto {
  // Either a tag (uppercase A-Z, 0-9, underscore, colon — Remnawave constraint)
  // or the literal string '__UNTAGGED__' to target hosts without a tag.
  @IsString()
  @Matches(/^([A-Z0-9_:]{1,32}|__UNTAGGED__)$/, {
    message:
      'tag must be 1-32 chars of A-Z, 0-9, underscore or colon, or the literal __UNTAGGED__',
  })
  tag!: string;

  @IsString()
  newAddress!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65_535)
  newPort?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ReplaceAddressDto {
  @IsString()
  newAddress!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65_535)
  newPort?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
