import { Test, TestingModule } from '@nestjs/testing';
import { TorrentInfoService } from './torrent-info.service';

describe('TorrentInfoService', () => {
  let service: TorrentInfoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TorrentInfoService],
    }).compile();

    service = module.get<TorrentInfoService>(TorrentInfoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
