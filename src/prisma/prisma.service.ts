import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Ensure a database name exists in the Mongo URI for Prisma.
    // When using mongodb-memory-server, getUri() may omit the db name,
    // resulting in an invalid namespace like ".Collection".
    const rawUrl = process.env.DATABASE_URL || '';
    const urlNeedsDbName = (() => {
      if (!rawUrl) return false;
      try {
        const parsed = new URL(rawUrl);
        // If pathname is empty or just '/', then there's no db name
        return parsed.pathname === '' || parsed.pathname === '/';
      } catch {
        return false;
      }
    })();

    const safeUrl = urlNeedsDbName
      ? `${rawUrl.replace(/\/?$/, '/')}appdb`
      : rawUrl;

    super(safeUrl ? { datasources: { db: { url: safeUrl } } } : undefined);
  }
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
