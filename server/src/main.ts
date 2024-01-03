import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import config from './config';

const { STREAMARR_SERVER_PORT, STREAMARR_LOG_LEVEL } = config();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: STREAMARR_LOG_LEVEL,
  });

  app.enableShutdownHooks();

  await app.listen(STREAMARR_SERVER_PORT, '0.0.0.0');
}
bootstrap();
