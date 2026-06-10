import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Card } from './card.entity';
import { Folder } from './folder.entity';

@Entity('links')
export class Link {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  url: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'simple-json', default: '[]' })
  tags: string[];

  @Column({ default: false })
  isFavorite: boolean;

  @Column({ default: false })
  isDead: boolean;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @Column({ type: 'datetime', nullable: true })
  lastCheckedAt: Date | null;

  @ManyToOne(() => Card, (card) => card.links, { onDelete: 'CASCADE' })
  card: Card;

  @Column()
  cardId: number;

  @ManyToOne(() => Folder, (folder) => folder.links, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  folder: Folder | null;

  @Column({ type: 'integer', nullable: true })
  folderId: number | null;

  @Column({ type: 'varchar', nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
