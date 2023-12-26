import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { TorrentsService } from './torrents.service';
import { CreateTorrentDto } from './dto/create-torrent.dto';
import { UpdateTorrentDto } from './dto/update-torrent.dto';

@Controller('api/torrents')
export class TorrentsController {
  constructor(private readonly torrentsService: TorrentsService) {}

  @Post()
  create(@Body() createTorrentDto: CreateTorrentDto) {
    return this.torrentsService.create(createTorrentDto);
  }

  @Get()
  findAll() {
    return this.torrentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.torrentsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTorrentDto: UpdateTorrentDto) {
    return this.torrentsService.update(+id, updateTorrentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.torrentsService.remove(+id);
  }
}
