import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  useWebtorrentServiceProvider,
  useTorrentUtilProvider,
} from '../module-providers';
import config from '../config';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [config],
    }),
  ],
  providers: [
    ConfigService,
    useTorrentUtilProvider(),
    useWebtorrentServiceProvider(),
  ],
})
export class WorkerModule {}
