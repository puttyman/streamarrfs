import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigService } from '@nestjs/config';
import {
  useTorrentUtilProvider,
  useWebtorrentServiceProvider,
} from './module-providers';
import { TorrentsService } from './torrents/torrents.service';
import { TypeOrmSQLITETestingModule } from './test-utils/TypeORMSQLITETestingModule';
import { EventEmitterTestingModule } from './test-utils/EventEmittterTestingModule';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      imports: [
        ...TypeOrmSQLITETestingModule(),
        ...EventEmitterTestingModule(),
      ],
      providers: [
        ConfigService,
        AppService,
        useTorrentUtilProvider(),
        useWebtorrentServiceProvider(),
        TorrentsService,
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('/status should return OK', async () => {
      const jsonStringResp = await appController.healthcheck();
      expect(jsonStringResp).toEqual({
        db: { healthy: true },
        service: { healthy: true },
        streamarrfs: { healthy: false },
        webtorrent: { healthy: true },
      });
    });
  });
});
