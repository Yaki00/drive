import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardsModule } from './cards/cards.module';
import { Card } from './entities/card.entity';
import { Folder } from './entities/folder.entity';
import { Link } from './entities/link.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'drive.db',
      entities: [Card, Folder, Link],
      synchronize: true,
    }),
    CardsModule,
  ],
})
export class AppModule {}
