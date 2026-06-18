import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Card } from '../entities/card.entity';
import { Folder } from '../entities/folder.entity';
import { Link } from '../entities/link.entity';
import { CardsService } from './cards.service';

describe('CardsService bulk import', () => {
  let service: CardsService;

  const cardsRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const foldersRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const linksRepository = {
    find: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => ({ id: 99, ...data })),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ max: 0 }),
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    cardsRepository.findOne.mockResolvedValue({
      id: 1,
      title: 'Test',
      folders: [],
      links: [],
      tags: [],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardsService,
        { provide: getRepositoryToken(Card), useValue: cardsRepository },
        { provide: getRepositoryToken(Folder), useValue: foldersRepository },
        { provide: getRepositoryToken(Link), useValue: linksRepository },
      ],
    }).compile();

    service = module.get(CardsService);
  });

  it('creates multiple links in bulk', async () => {
    const result = await service.addLinksBulk(1, {
      links: [
        { title: 'A', url: 'https://a.com' },
        { title: 'B', url: 'https://b.com' },
      ],
    });

    expect(result.created).toBe(2);
    expect(linksRepository.save).toHaveBeenCalledTimes(2);
  });

  it('does not mark links dead when network check is unreachable', async () => {
    const link = {
      id: 1,
      url: 'https://google.com',
      isDead: false,
    };
    linksRepository.find.mockResolvedValue([link]);

    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new Error('network blocked'));

    const result = await service.checkDeadLinks();

    expect(result.unreachable).toBe(1);
    expect(result.dead).toBe(0);
    expect(linksRepository.save).not.toHaveBeenCalled();

    fetchMock.mockRestore();
  });

  it('throws when target folder is missing', async () => {
    foldersRepository.findOne.mockResolvedValue(null);

    await expect(
      service.addLinksBulk(1, {
        folderId: 42,
        links: [{ title: 'A', url: 'https://a.com' }],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
