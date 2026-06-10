import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Card } from './card.entity';
import { Link } from './link.entity';

@Entity('folders')
export class Folder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @ManyToOne(() => Card, (card) => card.folders, { onDelete: 'CASCADE' })
  card: Card;

  @Column()
  cardId: number;

  @OneToMany(() => Link, (link) => link.folder, { cascade: true })
  links: Link[];

  @Column({ type: 'varchar', nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
