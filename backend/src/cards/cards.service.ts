import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Card } from '../entities/card.entity';
import { Folder } from '../entities/folder.entity';
import { Link } from '../entities/link.entity';
import { CreateCardDto } from './dto/create-card.dto';
import { CreateFolderDto } from './dto/create-folder.dto';
import { CreateLinkDto } from './dto/create-link.dto';
import { ReorderCardDto } from './dto/reorder-card.dto';
import { ReorderCardsDto } from './dto/reorder-cards.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { UpdateLinkDto } from './dto/update-link.dto';

@Injectable()
export class CardsService {
  constructor(
    @InjectRepository(Card)
    private readonly cardsRepository: Repository<Card>,
    @InjectRepository(Folder)
    private readonly foldersRepository: Repository<Folder>,
    @InjectRepository(Link)
    private readonly linksRepository: Repository<Link>,
  ) {}

  private formatCard(card: Card): Card {
    return {
      ...card,
      tags: card.tags ?? [],
      links: (card.links ?? [])
        .filter((link) => link.folderId == null)
        .map((link) => ({ ...link, tags: link.tags ?? [] })),
      folders: (card.folders ?? []).map((folder) => ({
        ...folder,
        links: (folder.links ?? []).map((link) => ({
          ...link,
          tags: link.tags ?? [],
        })),
      })),
    };
  }

  findAll(): Promise<Card[]> {
    return this.cardsRepository
      .find({
        relations: { folders: { links: true }, links: true },
        order: {
          sortOrder: 'ASC',
          createdAt: 'DESC',
          folders: { sortOrder: 'ASC', links: { sortOrder: 'ASC' } },
          links: { sortOrder: 'ASC' },
        },
      })
      .then((cards) => cards.map((card) => this.formatCard(card)));
  }

  async findOne(id: number): Promise<Card> {
    const card = await this.cardsRepository.findOne({
      where: { id },
      relations: { folders: { links: true }, links: true },
      order: {
        folders: { sortOrder: 'ASC', links: { sortOrder: 'ASC' } },
        links: { sortOrder: 'ASC' },
      },
    });

    if (!card) {
      throw new NotFoundException(`Card #${id} not found`);
    }

    return this.formatCard(card);
  }

  async create(dto: CreateCardDto): Promise<Card> {
    const maxOrder = await this.cardsRepository
      .createQueryBuilder('card')
      .select('MAX(card.sortOrder)', 'max')
      .getRawOne<{ max: number | null }>();

    const card = this.cardsRepository.create({
      ...dto,
      tags: dto.tags ?? [],
      sortOrder: (maxOrder?.max ?? -1) + 1,
    });
    const saved = await this.cardsRepository.save(card);
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateCardDto): Promise<Card> {
    const card = await this.findOne(id);
    Object.assign(card, dto);
    await this.cardsRepository.save(card);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const card = await this.findOne(id);
    await this.cardsRepository.remove(card);
  }

  async reorderCards(dto: ReorderCardsDto): Promise<Card[]> {
    for (const item of dto.items) {
      const card = await this.cardsRepository.findOne({ where: { id: item.id } });
      if (!card) {
        throw new NotFoundException(`Card #${item.id} not found`);
      }
      card.sortOrder = item.sortOrder;
      await this.cardsRepository.save(card);
    }
    return this.findAll();
  }

  async addFolder(cardId: number, dto: CreateFolderDto): Promise<Folder> {
    await this.findOne(cardId);
    const maxOrder = await this.foldersRepository
      .createQueryBuilder('folder')
      .where('folder.cardId = :cardId', { cardId })
      .select('MAX(folder.sortOrder)', 'max')
      .getRawOne<{ max: number | null }>();

    const folder = this.foldersRepository.create({
      ...dto,
      cardId,
      sortOrder: (maxOrder?.max ?? -1) + 1,
    });
    return this.foldersRepository.save(folder);
  }

  async updateFolder(folderId: number, dto: UpdateFolderDto): Promise<Folder> {
    const folder = await this.foldersRepository.findOne({
      where: { id: folderId },
      relations: { links: true },
    });

    if (!folder) {
      throw new NotFoundException(`Folder #${folderId} not found`);
    }

    Object.assign(folder, dto);
    return this.foldersRepository.save(folder);
  }

  async removeFolder(folderId: number): Promise<void> {
    const folder = await this.foldersRepository.findOne({ where: { id: folderId } });

    if (!folder) {
      throw new NotFoundException(`Folder #${folderId} not found`);
    }

    await this.foldersRepository.remove(folder);
  }

  async addLink(cardId: number, dto: CreateLinkDto): Promise<Link> {
    await this.findOne(cardId);

    if (dto.folderId) {
      const folder = await this.foldersRepository.findOne({
        where: { id: dto.folderId, cardId },
      });

      if (!folder) {
        throw new NotFoundException(`Folder #${dto.folderId} not found in card #${cardId}`);
      }
    }

    const maxOrder = await this.getNextLinkSortOrder(cardId, dto.folderId ?? null);

    const link = this.linksRepository.create({
      ...dto,
      cardId,
      folderId: dto.folderId ?? null,
      tags: dto.tags ?? [],
      isFavorite: dto.isFavorite ?? false,
      sortOrder: maxOrder,
    });

    return this.linksRepository.save(link);
  }

  async updateLink(linkId: number, dto: UpdateLinkDto): Promise<Link> {
    const link = await this.linksRepository.findOne({ where: { id: linkId } });

    if (!link) {
      throw new NotFoundException(`Link #${linkId} not found`);
    }

    const previousCardId = link.cardId;
    const previousFolderId = link.folderId;
    const cardChanged = dto.cardId !== undefined && dto.cardId !== previousCardId;
    const folderChanged =
      dto.folderId !== undefined && dto.folderId !== previousFolderId;

    if (cardChanged) {
      await this.findOne(dto.cardId!);
      link.cardId = dto.cardId!;
      if (dto.folderId === undefined) {
        link.folderId = null;
      }
    }

    if (dto.folderId !== undefined) {
      if (dto.folderId !== null) {
        const folder = await this.foldersRepository.findOne({
          where: { id: dto.folderId, cardId: link.cardId },
        });

        if (!folder) {
          throw new NotFoundException(`Folder #${dto.folderId} not found`);
        }
      }
      link.folderId = dto.folderId;
    }

    if (cardChanged || folderChanged) {
      link.sortOrder = await this.getNextLinkSortOrder(link.cardId, link.folderId);
    }

    if (dto.url && dto.url !== link.url) {
      link.isDead = false;
      link.lastCheckedAt = null;
    }

    const assignable = { ...dto };
    delete assignable.cardId;
    delete assignable.folderId;
    Object.assign(link, assignable);

    return this.linksRepository.save(link);
  }

  async removeLink(linkId: number): Promise<void> {
    const link = await this.linksRepository.findOne({ where: { id: linkId } });

    if (!link) {
      throw new NotFoundException(`Link #${linkId} not found`);
    }

    await this.linksRepository.remove(link);
  }

  async reorderCard(cardId: number, dto: ReorderCardDto): Promise<Card> {
    await this.findOne(cardId);

    for (const item of dto.items) {
      if (item.type === 'folder') {
        const folder = await this.foldersRepository.findOne({
          where: { id: item.id, cardId },
        });
        if (!folder) {
          throw new NotFoundException(`Folder #${item.id} not found in card #${cardId}`);
        }
        folder.sortOrder = item.sortOrder;
        await this.foldersRepository.save(folder);
      } else {
        const link = await this.linksRepository.findOne({
          where: { id: item.id, cardId },
        });
        if (!link) {
          throw new NotFoundException(`Link #${item.id} not found in card #${cardId}`);
        }

        if (item.folderId) {
          const folder = await this.foldersRepository.findOne({
            where: { id: item.folderId, cardId },
          });
          if (!folder) {
            throw new NotFoundException(`Folder #${item.folderId} not found`);
          }
        }

        link.sortOrder = item.sortOrder;
        link.folderId = item.folderId ?? null;
        await this.linksRepository.save(link);
      }
    }

    return this.findOne(cardId);
  }

  async checkDeadLinks(): Promise<{ checked: number; dead: number; skipped: number }> {
    const links = await this.linksRepository.find();
    let dead = 0;
    let skipped = 0;

    for (const link of links) {
      if (!this.isUrlSafe(link.url)) {
        skipped++;
        continue;
      }

      const isDead = await this.isLinkDead(link.url);
      link.isDead = isDead;
      link.lastCheckedAt = new Date();
      await this.linksRepository.save(link);
      if (isDead) dead++;
    }

    return { checked: links.length - skipped, dead, skipped };
  }

  private async getNextLinkSortOrder(
    cardId: number,
    folderId: number | null,
  ): Promise<number> {
    const query = this.linksRepository
      .createQueryBuilder('link')
      .where('link.cardId = :cardId', { cardId })
      .select('MAX(link.sortOrder)', 'max');

    if (folderId === null) {
      query.andWhere('link.folderId IS NULL');
    } else {
      query.andWhere('link.folderId = :folderId', { folderId });
    }

    const result = await query.getRawOne<{ max: number | null }>();
    return (result?.max ?? -1) + 1;
  }

  private isUrlSafe(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return false;

      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal')
      ) {
        return false;
      }

      if (/^127\./.test(hostname) || hostname === '0.0.0.0') return false;
      if (/^10\./.test(hostname)) return false;
      if (/^192\.168\./.test(hostname)) return false;
      if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return false;
      if (hostname === '[::1]' || hostname.startsWith('fc') || hostname.startsWith('fd')) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private async isLinkDead(url: string): Promise<boolean> {
    if (!this.isUrlSafe(url)) return false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      let response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'Bookmarks-LinkChecker/1.0' },
      });

      if (response.status === 405 || response.status === 501) {
        response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          redirect: 'follow',
          headers: { 'User-Agent': 'Bookmarks-LinkChecker/1.0' },
        });
      }

      clearTimeout(timeout);
      return response.status >= 400;
    } catch {
      return true;
    }
  }
}
