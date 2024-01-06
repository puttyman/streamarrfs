import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WebTorrentService } from './webtorrent/webtorrent.service';
import { ConfigService } from '@nestjs/config';

describe('AppController', () => {
  let appController: AppController;
  let webtorrentService: WebTorrentService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [ConfigService, AppService, WebTorrentService],
    }).compile();

    appController = app.get<AppController>(AppController);
    webtorrentService = app.get<WebTorrentService>(WebTorrentService);
  });

  describe('root', () => {
    it('/status should return OK', () => {
      expect(appController.healthcheck()).toBe('OK');
    });
  });
});
