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

describe.skip('AppController', () => {
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
    appController = app.get<AppController>(AppController);
  });

  describe('healthcheck', () => {
    it('should be true for service', async () => {
      const jsonStringResp = await appController.healthcheck();
      expect(jsonStringResp?.service?.healthy).toBeTruthy();
    });
  });
});
