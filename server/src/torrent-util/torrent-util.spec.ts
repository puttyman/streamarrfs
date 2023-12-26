import { Test, TestingModule } from '@nestjs/testing';
import { TorrentUtil } from './torrent.util';

describe('ParseTorrent', () => {
  let parseTorrent: TorrentUtil;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      providers: [TorrentUtil],
    }).compile();

    parseTorrent = app.get<TorrentUtil>(TorrentUtil);
  });

  describe('getMagnetLinkFromJacketteUrl', () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('', {
        status: 302,
        statusText: 'OK',
        headers: {
          location: 'magnet://',
        },
      }),
    );
    it('it should return the magnet link from a jackette url', async () => {
      const magnetUrl = await parseTorrent.getMagnetLinkFromJacketteUrl(
        'http://jacket/torrent/url/magnet',
      );
      expect(magnetUrl).toBe('magnet://');
    });
  });

  describe('getTorrentFromUrl', () => {
    it('it should return the magnet link from a jackette url', async () => {
      const magnetUrl = await parseTorrent.getTorrentFromUrl(
        'http://10.0.0.100:9117/dl/yts/?jackett_apikey=ryaz13l0u158v140x39zroy72lw1ke8i&path=Q2ZESjhKLWRROUNmNVdGTm9tNG9Rdl9HdENfTnFjWFQ2WHZWYl8tbTZPU08wRHhzd0dWSVo5dFNCLUg4UWRlTVNiUl8zb0swd045TXctNzJ4VHVEcC1CQkozb29YQ2tNQXRRejlJeTRMN3VRZlRjTTc4enlpa0hHWUp2UERkWXJHdlh1UWs4SXdwNzNNbFNvZEtPQi1maEo3bmJ1aWFNUndmdDZTU1ZoendKblZGemZDU29xM0VxdnVrUE1NVTk3V1VEdGxFejd5ZUtRd2EzNXpRRVl2eWNQeS1N&file=The+Family+Plan+(2023)+1080p+WEBRip+5.1+x264+-YTS',
      );
      expect(magnetUrl).toBeTruthy();
    });
  });
});
