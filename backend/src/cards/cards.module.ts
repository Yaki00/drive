import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Card } from '../entities/card.entity';
import { Folder } from '../entities/folder.entity';
import { Link } from '../entities/link.entity';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';

@Module({
  imports: [TypeOrmModule.forFeature([Card, Folder, Link])],
  controllers: [CardsController],
  providers: [CardsService],
})
export class CardsModule {}
