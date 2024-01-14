import { Controller, Post, Body, Get } from '@nestjs/common';
import { StreamarrService } from './streamarr.service';
import { AddTorrentStreamarrDto } from './dto/create-streamarr.dto';
import type { Torrent } from 'webtorrent';
@Controller('api/streamarrfs')
export class StreamarrController {
  constructor(private readonly streamarrsService: StreamarrService) {}

  @Post('add-torrent')
  async addTorrent(@Body() addTorrentStreamarrDto: AddTorrentStreamarrDto) {
    return this.streamarrsService.addTorrent(addTorrentStreamarrDto);
  }

  @Get('torrents')
  torrents(): Partial<Torrent>[] {
    return this.streamarrsService.torrents();
  }

  @Get('/pool/stats')
  async worker() {
    return {};
  }
}
