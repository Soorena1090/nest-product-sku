import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductModule } from './product/product.module';
import { SkuModule } from './sku/sku.module';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [ProductModule, SkuModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
