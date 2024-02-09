import { Controller, Get } from '@nestjs/common';
import { StreamarrService } from './streamarr.service';
import type { Torrent } from 'webtorrent';
@Controller('api/streamarrfs')
export class StreamarrController {
  constructor(private readonly streamarrsService: StreamarrService) {}

  @Get('torrents')
  torrents(): Partial<Torrent>[] {
    return this.streamarrsService.torrents();
  }
}
