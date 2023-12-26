import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import config from './config';

async function bootstrap() {
  const logger = [
    ...['debug', 'error', 'fatal', 'log', 'warn'],
    ...(process.env.NODE_ENV !== 'production' ? ['verbose'] : []),
  ];
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // @ts-ignore
    logger,
  });
  app.enableShutdownHooks();
  await app.listen(config().STREAMARR_SERVER_PORT, '0.0.0.0');
}
bootstrap();
