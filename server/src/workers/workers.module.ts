import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  useWebtorrentServiceProvider,
  useTorrentUtilProvider,
} from '../providers';

@Module({
  providers: [
    ConfigService,
    useTorrentUtilProvider(),
    useWebtorrentServiceProvider(),
  ],
})
export class WorkerModule {}
