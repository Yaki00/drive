import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Folder } from './folder.entity';
import { Link } from './link.entity';

@Entity('cards')
export class Card {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', default: '#00965A' })
  color: string;

  @Column({ type: 'simple-json', default: '[]' })
  tags: string[];

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @OneToMany(() => Folder, (folder) => folder.card, { cascade: true })
  folders: Folder[];

  @OneToMany(() => Link, (link) => link.card, { cascade: true })
  links: Link[];

  @Column({ type: 'varchar', nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
