import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import RssParser from 'rss-parser';

import { TorrentsService } from '../torrents/torrents.service';

@Injectable()
export class TorrentsFromFeedService {
  private readonly logger = new Logger(TorrentsFromFeedService.name);
  private isTaskRunning: boolean;
  private rssParser;
  private feedUrls;

  constructor(
    private readonly torrentService: TorrentsService,
    private readonly configService: ConfigService,
  ) {
    this.rssParser = new RssParser({
      customFields: {
        item: [['torznab:attr', 'torznabAttr']],
      },
    });
    this.feedUrls = this.configService.get<Array<string>>(
      'STREAMARR_FEED_URLS',
    );
  }

  @Cron(CronExpression.EVERY_10_SECONDS, { name: TorrentsFromFeedService.name })
  async torrentProducer() {
    if (this.configService.get<string>('STREAMARR_FEED_DISABLED') === 'true') {
      this.logger.log(`aborting feed is disabled`);
      return;
    }

    if (this.isTaskRunning) {
      this.logger.log(`aborting an existing task running already`);
      return;
    }

    try {
      this.isTaskRunning = true;
      this.logger.log(`fetching torrents from feed`);
      for (const feedUrl of this.feedUrls) {
        const feedContents = await this.rssParser.parseURL(feedUrl);
        this.logger.log(
          `received ${feedContents.items.length ?? 'no'} items from feed`,
        );
        for (const { guid: feedGuid, link: feedURL } of feedContents.items) {
          if (!feedGuid || !feedURL) continue;
          const existingTorrent =
            await this.torrentService.findOneByFeedGuid(feedGuid);
          if (!existingTorrent) {
            await this.torrentService.create({
              feedGuid,
              feedURL,
              isVisible: false,
            });
          }
        }
      }
    } catch (err) {
      this.logger.error({ err }, `error running feed cron`);
    }

    this.isTaskRunning = false;
  }
}
