import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  ValidateNested,
} from 'class-validator';

export class ReorderItemDto {
  @IsIn(['link', 'folder'])
  type: 'link' | 'folder';

  @IsInt()
  id: number;

  @IsInt()
  sortOrder: number;

  @IsInt()
  @IsOptional()
  folderId?: number | null;
}

export class ReorderCardDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}
