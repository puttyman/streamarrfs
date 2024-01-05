import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1704170838512 implements MigrationInterface {
  name = 'Init1704170838512';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "torrent" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "infoHash" varchar, "feedGuid" varchar NOT NULL, "files" text, "name" varchar, "magnetURI" text, "feedURL" text, "isVisible" boolean NOT NULL, "status" varchar NOT NULL DEFAULT ('QUEUED'), "errors" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_86566d22801f31f272c6b16e71d" UNIQUE ("feedGuid"), CONSTRAINT "UQ_86566d22801f31f272c6b16e71d" UNIQUE ("feedGuid"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5dec9909d06ff1edc2984ef93d" ON "torrent" ("infoHash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_86566d22801f31f272c6b16e71" ON "torrent" ("feedGuid") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_86566d22801f31f272c6b16e71"`);
    await queryRunner.query(`DROP INDEX "IDX_5dec9909d06ff1edc2984ef93d"`);
    await queryRunner.query(`DROP TABLE "torrent"`);
  }
}
