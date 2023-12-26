import { TypeOrmModule } from '@nestjs/typeorm';
import { Torrent } from '../torrents/entities/torrent.entity';

export const TypeOrmSQLITETestingModule = () => [
  TypeOrmModule.forRoot({
    type: 'better-sqlite3',
    database: ':memory:',
    dropSchema: true,
    entities: [Torrent],
    synchronize: true,
  }),
  TypeOrmModule.forFeature([Torrent]),
];
