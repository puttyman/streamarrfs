import { Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import config from './config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TorrentsModule } from './torrents/torrents.module';
import { StreamarrController } from './streamarr/streamarr.controller';
import { StreamarrService } from './streamarr/streamarr.service';
import { StreamarrFsService } from './streamarr-fs/streamarr-fs.service';
import { WorkerPool } from './worker.pool';
import {
  useWebtorrentServiceProvider,
  useTorrentUtilProvider,
} from './providers';
import { TorrentsFromFeedService } from './producers/torrents-from-feed.service';
import { TorrentFromQueueService } from './producers/torrents-from-queue.service';
import { TorrentsFreeService } from './producers/torrents-free.service';

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
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: config().STREAMARR_DB_PATH,
      entities: ['dist/**/*.entity.js'],
      // TODO: Implement db migrations
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    TorrentsModule,
  ],
  controllers: [AppController, StreamarrController],
  providers: [
    AppService,
    useTorrentUtilProvider(),
    StreamarrService,
    TorrentsFromFeedService,
    StreamarrFsService,
    WorkerPool,
    useWebtorrentServiceProvider(config().STREAMARR_WEBTORRENT_TORRENT_PORT),
    TorrentFromQueueService,
    TorrentsFreeService,
  ],
})
export class AppModule implements NestModule {
  configure() {}
}
