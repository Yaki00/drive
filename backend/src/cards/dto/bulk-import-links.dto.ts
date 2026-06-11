import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { CreateLinkDto } from './create-link.dto';

export class BulkImportLinksDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateLinkDto)
  links: CreateLinkDto[];

  @IsInt()
  @IsOptional()
  folderId?: number | null;
}
