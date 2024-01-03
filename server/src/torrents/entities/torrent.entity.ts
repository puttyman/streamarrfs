import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';

export enum TorrentInfoStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  TIMEOUT = 'TIMEOUT',
  ERROR = 'ERROR',
}

@Entity()
@Unique(['feedGuid'])
export class Torrent {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ nullable: true })
  @Index()
  public infoHash: string;

  @Column({ unique: true })
  @Index()
  public feedGuid: string;

  @Column({ nullable: true, type: 'text' })
  public files: string;

  @Column({ nullable: true })
  public name: string;

  @Column({ nullable: true, type: 'text' })
  @Index()
  magnetURI: string;

  @Column({ nullable: true, type: 'text' })
  feedURL: string;

  @Column({ type: 'boolean' })
  public isVisible: boolean;

  @Column({
    default: TorrentInfoStatus.QUEUED,
  })
  status: TorrentInfoStatus;

  @Column({ nullable: true, type: 'text' })
  public errors: string;

  @CreateDateColumn()
  public createdAt: Date;

  @UpdateDateColumn()
  public updatedAt: Date;
}
