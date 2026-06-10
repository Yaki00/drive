import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CardsService } from './cards.service';
import { CreateCardDto } from './dto/create-card.dto';
import { CreateFolderDto } from './dto/create-folder.dto';
import { CreateLinkDto } from './dto/create-link.dto';
import { ReorderCardDto } from './dto/reorder-card.dto';
import { ReorderCardsDto } from './dto/reorder-cards.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { UpdateLinkDto } from './dto/update-link.dto';

@Controller('cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Get()
  findAll() {
    return this.cardsService.findAll();
  }

  @Post('links/check-dead')
  checkDeadLinks() {
    return this.cardsService.checkDeadLinks();
  }

  @Post('reorder')
  reorderCards(@Body() dto: ReorderCardsDto) {
    return this.cardsService.reorderCards(dto);
  }

  @Patch('folders/:folderId')
  updateFolder(
    @Param('folderId', ParseIntPipe) folderId: number,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.cardsService.updateFolder(folderId, dto);
  }

  @Delete('folders/:folderId')
  removeFolder(@Param('folderId', ParseIntPipe) folderId: number) {
    return this.cardsService.removeFolder(folderId);
  }

  @Patch('links/:linkId')
  updateLink(
    @Param('linkId', ParseIntPipe) linkId: number,
    @Body() dto: UpdateLinkDto,
  ) {
    return this.cardsService.updateLink(linkId, dto);
  }

  @Delete('links/:linkId')
  removeLink(@Param('linkId', ParseIntPipe) linkId: number) {
    return this.cardsService.removeLink(linkId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.cardsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCardDto) {
    return this.cardsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCardDto) {
    return this.cardsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.cardsService.remove(id);
  }

  @Post(':id/folders')
  addFolder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateFolderDto,
  ) {
    return this.cardsService.addFolder(id, dto);
  }

  @Post(':id/links')
  addLink(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateLinkDto,
  ) {
    return this.cardsService.addLink(id, dto);
  }

  @Post(':id/reorder')
  reorder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReorderCardDto,
  ) {
    return this.cardsService.reorderCard(id, dto);
  }
}
