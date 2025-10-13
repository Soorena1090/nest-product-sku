import { Module } from '@nestjs/common';
import { SkuController } from './sku.controller';
import { SkuService } from './sku.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [SkuController],
  providers: [SkuService, PrismaService],
})
export class SkuModule {}
