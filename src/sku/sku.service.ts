import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export type CreateSkuInput = {
  productId: string;
  price: number;
  quantity: number;
  externalId: string;
  image: string;
};

export type UpdateSkuInput = Partial<
  Omit<CreateSkuInput, 'productId' | 'externalId'>
> & {
  externalId?: string; // allow changing externalId if needed
};

@Injectable()
export class SkuService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.sKU.findMany();
  }

  async findOne(id: string) {
    const sku = await this.prisma.sKU.findUnique({ where: { id } });
    if (!sku) throw new NotFoundException('SKU not found');
    return sku;
  }

  async create(input: CreateSkuInput) {
    this.validateSkuInput(input);

    // ensure product exists
    const product = await this.prisma.physicalProduct.findUnique({
      where: { id: input.productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    // Enforce unique externalId explicitly
    const existingByExternal = await this.prisma.sKU.findUnique({
      where: { externalId: input.externalId },
    });
    if (existingByExternal) {
      throw new BadRequestException('externalId already exists');
    }

    const sku = await this.prisma.sKU.create({
      data: {
        productId: input.productId,
        price: input.price,
        quantity: input.quantity,
        externalId: input.externalId,
        image: input.image,
      },
    });

    const purchasable = await this.computePurchasableForProductId(
      this.prisma as unknown as Prisma.TransactionClient,
      input.productId,
    );
    await this.prisma.physicalProduct.update({
      where: { id: input.productId },
      data: { purchasable },
    });
    return sku;
  }

  async update(id: string, input: UpdateSkuInput) {
    const existing = await this.prisma.sKU.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('SKU not found');

    if (input.price !== undefined) {
      if (!Number.isFinite(input.price)) {
        throw new BadRequestException('price must be a number');
      }
      if (input.price < 0) {
        throw new BadRequestException(
          'price must be greater than or equal to 0',
        );
      }
    }
    if (input.quantity !== undefined) {
      if (!Number.isInteger(input.quantity)) {
        throw new BadRequestException('quantity must be an integer');
      }
      if (input.quantity < 0) {
        throw new BadRequestException(
          'quantity must be greater than or equal to 0',
        );
      }
    }
    if (
      input.image !== undefined &&
      (!input.image || typeof input.image !== 'string')
    ) {
      throw new BadRequestException('image must be a non-empty string');
    }

    // if externalId provided, ensure unique (excluding current SKU)
    if (input.externalId) {
      const dup = await this.prisma.sKU.findUnique({
        where: { externalId: input.externalId },
      });
      if (dup && dup.id !== id) {
        throw new BadRequestException('externalId already exists');
      }
    }

    const updateData: {
      price?: number;
      quantity?: number;
      externalId?: string;
      image?: string;
    } = {};
    if (input.price !== undefined) updateData.price = input.price;
    if (input.quantity !== undefined) updateData.quantity = input.quantity;
    if (input.externalId !== undefined)
      updateData.externalId = input.externalId;
    if (input.image !== undefined) updateData.image = input.image;

    const sku = await this.prisma.sKU.update({
      where: { id },
      data: updateData,
    });
    const purchasable = await this.computePurchasableForProductId(
      this.prisma as unknown as Prisma.TransactionClient,
      sku.productId,
    );
    await this.prisma.physicalProduct.update({
      where: { id: sku.productId },
      data: { purchasable },
    });
    return sku;
  }

  async remove(id: string) {
    const existing = await this.prisma.sKU.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('SKU not found');

    await this.prisma.sKU.delete({ where: { id } });
    const purchasable = await this.computePurchasableForProductId(
      this.prisma as unknown as Prisma.TransactionClient,
      existing.productId,
    );
    await this.prisma.physicalProduct.update({
      where: { id: existing.productId },
      data: { purchasable },
    });
  }

  private validateSkuInput(input: CreateSkuInput) {
    if (!input.productId)
      throw new BadRequestException('productId is required');
    if (input.price == null) throw new BadRequestException('price is required');
    if (input.quantity == null)
      throw new BadRequestException('quantity is required');
    if (!Number.isFinite(input.price))
      throw new BadRequestException('price must be a number');
    if (input.price < 0)
      throw new BadRequestException('price must be greater than or equal to 0');
    if (!Number.isInteger(input.quantity))
      throw new BadRequestException('quantity must be an integer');
    if (input.quantity < 0)
      throw new BadRequestException(
        'quantity must be greater than or equal to 0',
      );
    if (!input.externalId)
      throw new BadRequestException('externalId is required');
    if (!input.image) throw new BadRequestException('image is required');
  }

  private async computePurchasableForProductId(
    tx: Prisma.TransactionClient,
    productId: string,
  ) {
    const product = await tx.physicalProduct.findUnique({
      where: { id: productId },
    });
    if (!product) return false;
    if (product.status !== 'PUBLISHED') return false;
    const anyInStock = await tx.sKU.findFirst({
      where: { productId, quantity: { gt: 0 } },
    });
    return Boolean(anyInStock);
  }
}
