import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndex1704254119431 implements MigrationInterface {
  name = 'AddIndex1704254119431';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_f940f56e0f6a3b8f34a62e721b" ON "torrent" ("magnetURI") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_f940f56e0f6a3b8f34a62e721b"`);
  }
}
