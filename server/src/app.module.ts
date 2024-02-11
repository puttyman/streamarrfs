import { Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import config from './config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StreamarrController } from './streamarr/streamarr.controller';
import { StreamarrService } from './streamarr/streamarr.service';
import { StreamarrFsService } from './streamarrfs/streamarrfs.service';
import {
  useWebtorrentServiceProvider,
  useTorrentUtilProvider,
} from './module-providers';
import { JacketteTorrentSourceService } from './torrents/sources/feeds/jackette/jackette-torrent-source.service';
import { TorrentIndexerService } from './torrents/indexer/torrent-indexer.service';
import { FreeTorrentFeedService } from './torrents/sources/free/free-torrent-source.service';
import { dataSourceOptions } from 'db/data-source';
import { TorrentInfoService } from './torrent-info/torrent-info.service';
import { Torrent } from './torrents/db/entities/torrent.entity';
import { TorrentsService } from './torrents/torrents.service';
import { TorrentsController } from './torrents/torrents.controller';
@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      load: [config],
    }),
    EventEmitterModule.forRoot({
      // set this to `true` to use wildcards
      wildcard: true,
      // the delimiter used to segment namespaces
      delimiter: '.',
      // set this to `true` if you want to emit the newListener event
      newListener: false,
      // set this to `true` if you want to emit the removeListener event
      removeListener: false,
      // the maximum amount of listeners that can be assigned to an event
      maxListeners: 10,
      // show event name in memory leak message when more than maximum amount of listeners is assigned
      verboseMemoryLeak: true,
      // disable throwing uncaughtException if an error event is emitted and it has no listeners
      ignoreErrors: false,
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    TypeOrmModule.forFeature([Torrent]),
  ],
  controllers: [AppController, TorrentsController, StreamarrController],
  providers: [
    TorrentsService,
    AppService,
    useTorrentUtilProvider(),
    StreamarrService,
    JacketteTorrentSourceService,
    StreamarrFsService,
    useWebtorrentServiceProvider(config().STREAMARRFS_WEBTORRENT_TORRENT_PORT),
    TorrentIndexerService,
    FreeTorrentFeedService,
    TorrentInfoService,
  ],
})
export class AppModule implements NestModule {
  configure() {}
}
