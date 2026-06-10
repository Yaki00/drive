import { Type } from 'class-transformer';
import { IsArray, IsInt, ValidateNested } from 'class-validator';

class CardOrderItem {
  @IsInt()
  id: number;

  @IsInt()
  sortOrder: number;
}

export class ReorderCardsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CardOrderItem)
  items: CardOrderItem[];
}
