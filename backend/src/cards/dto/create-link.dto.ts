import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class CreateLinkDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsUrl({}, { message: 'url must be a valid URL' })
  url: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @IsOptional()
  folderId?: number | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsBoolean()
  @IsOptional()
  isFavorite?: boolean;

  @IsString()
  @IsOptional()
  createdBy?: string;
}
