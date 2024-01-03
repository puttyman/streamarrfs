import { DataSource, DataSourceOptions } from 'typeorm';

export const dataSourceOptions: DataSourceOptions = {
  type: 'better-sqlite3',
  database: 'db/db.sqlite',
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/db/migrations/*.js'],
  // synchronize: true,
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
