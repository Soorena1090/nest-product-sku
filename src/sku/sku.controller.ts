import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { SkuService } from './sku.service';
import { CreateSkuDto } from './dto/create-sku.dto';
import { UpdateSkuDto } from './dto/update-sku.dto';

@Controller('skus')
export class SkuController {
  constructor(private readonly skuService: SkuService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() body: CreateSkuDto) {
    return this.skuService.create(body);
  }

  @Get()
  async findAll() {
    return this.skuService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.skuService.findOne(id);
  }

  @Put(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async update(@Param('id') id: string, @Body() body: UpdateSkuDto) {
    return this.skuService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.skuService.remove(id);
  }
}
