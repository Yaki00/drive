import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { CardsModule } from './cards/cards.module';
import { Card } from './entities/card.entity';
import { Folder } from './entities/folder.entity';
import { Link } from './entities/link.entity';

const serveStatic = process.env.SERVE_STATIC === 'true';
const dataDir = process.env.DATA_DIR ?? '.';

@Module({
  imports: [
    ...(serveStatic
      ? [
          ServeStaticModule.forRoot({
            rootPath: join(__dirname, 'public'),
            exclude: ['/cards', '/cards/(.*)', '/health'],
            serveStaticOptions: {
              index: false,
            },
            renderPath: '/{*path}',
          }),
        ]
      : []),
    TypeOrmModule.forRoot({
      type: 'sqljs',
      location: join(dataDir, 'drive.db'),
      autoSave: true,
      entities: [Card, Folder, Link],
      synchronize: true,
    }),
    CardsModule,
  ],
})
export class AppModule {}
