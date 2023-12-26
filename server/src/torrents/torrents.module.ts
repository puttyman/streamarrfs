import { Module } from '@nestjs/common';
import { TorrentsService } from './torrents.service';
import { TorrentsController } from './torrents.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Torrent } from './entities/torrent.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Torrent])],
  controllers: [TorrentsController],
  providers: [TorrentsService],
  exports: [TorrentsService],
})
export class TorrentsModule {}
