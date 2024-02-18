import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TorrentInfoService } from './torrent-info.service';
import { useTorrentUtilProvider } from '../module-providers/useTorrentUtilProvider';

describe('TorrentInfoService', () => {
  let torrentInfoService: TorrentInfoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConfigService, useTorrentUtilProvider(), TorrentInfoService],
    }).compile();

    torrentInfoService = module.get<TorrentInfoService>(TorrentInfoService);
  });

  it('should be defined after creation', () => {
    expect(torrentInfoService).toBeDefined();
  });
});
