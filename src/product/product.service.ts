import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProductDto } from './dto/update-product.dto';

type PackagingInput = {
  width?: number | null;
  height?: number | null;
  length?: number | null;
  weight?: number | null;
};

export type CreateSkuInput = {
  price: number;
  quantity: number;
  externalId: string;
  image?: string | null;
};

// Use explicit interfaces for service layer to avoid any/unknown from DTO runtime types
export interface CreateProductInput {
  title: string;
  description: string;
  images: string[];
  packaging: PackagingInput;
  shippingType: string;
  status: 'DRAFT' | 'PUBLISHED';
  skus: CreateSkuInput[];
}

export type UpdateProductInput = UpdateProductDto;
type TxClient = Pick<PrismaService, 'physicalProduct' | 'sKU'>;

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateProductInput) {
    this.validateProductInput(input);

    // Enforce SKU-level business rules prior to DB round-trips
    for (const sku of input.skus) {
      if (sku.price < 0) {
        console.warn(`SKU ${sku.externalId} had negative price, set to 0`);
        sku.price = 0;
      }
      if (sku.quantity < 0) {
        throw new BadRequestException('sku.quantity must be >= 0');
      }
    }

    // Ensure externalIds are unique within the payload
    const externalIds = input.skus.map((s) => s.externalId);
    const externalIdSet = new Set(externalIds);
    if (externalIdSet.size !== externalIds.length) {
      throw new BadRequestException('sku.externalId values must be unique');
    }

    // Use Mongo interactive transaction so product and SKUs are atomic
    const createdProduct = await this.prisma.$transaction(async (tx) => {
      const product = await tx.physicalProduct.create({
        data: {
          title: input.title,
          description: input.description,
          images: input.images,
          packaging: input.packaging,
          shippingType: input.shippingType,
          status: input.status,
          purchasable: false,
        },
      });

      // Ensure no externalId collision exists in DB
      const existing = await tx.sKU.findMany({
        where: { externalId: { in: externalIds } },
        select: { externalId: true },
      });
      if (existing.length > 0) {
        const taken = existing.map((e) => e.externalId).join(', ');
        throw new BadRequestException(
          `sku.externalId must be unique. Already exists: ${taken}`,
        );
      }

      // Create SKUs in bulk; any failure rolls back the transaction
      await tx.sKU.createMany({
        data: input.skus.map((s: CreateSkuInput) => ({
          productId: product.id,
          price: s.price,
          quantity: s.quantity,
          externalId: s.externalId,
          image: s.image ?? null,
        })),
      });

      // Compute and set purchasable based on status and SKU stock
      const purchasable = await this.computePurchasableForProductId(
        tx as unknown as TxClient,
        product.id,
      );
      const updated = await tx.physicalProduct.update({
        where: { id: product.id },
        data: { purchasable },
      });

      return updated;
    });

    return createdProduct;
  }

  async findAll() {
    return this.prisma.physicalProduct.findMany();
  }

  async findOne(id: string) {
    const product = await this.prisma.physicalProduct.findUnique({
      where: { id },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: string, input: UpdateProductInput) {
    // ensure exists first
    await this.ensureProductExists(id);

    if (input.status !== undefined) this.validateStatus(input.status);
    if (input.title !== undefined && !input.title) {
      throw new BadRequestException('title must not be empty');
    }
    if (input.description !== undefined && !input.description) {
      throw new BadRequestException('description must not be empty');
    }
    if (input.images !== undefined) {
      if (!Array.isArray(input.images) || input.images.length === 0) {
        throw new BadRequestException('images must be a non-empty array');
      }
      for (const img of input.images) {
        if (typeof img !== 'string' || !img) {
          throw new BadRequestException(
            'each image must be a non-empty string',
          );
        }
      }
    }
    if (input.packaging !== undefined) {
      const p = input.packaging as PackagingInput;
      const numericOrNull = (v: unknown) => v == null || typeof v === 'number';
      if (
        !numericOrNull(p.width) ||
        !numericOrNull(p.height) ||
        !numericOrNull(p.length) ||
        !numericOrNull(p.weight)
      ) {
        throw new BadRequestException(
          'packaging fields must be numbers or null',
        );
      }
    }
    if (input.shippingType !== undefined && !input.shippingType) {
      throw new BadRequestException('shippingType must not be empty');
    }

    const product = await this.prisma.physicalProduct.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        images: input.images,
        packaging: input.packaging,
        shippingType: input.shippingType,
        status: input.status,
      },
    });

    const purchasable = await this.computePurchasableForProductId(
      this.prisma,
      product.id,
    );
    return this.prisma.physicalProduct.update({
      where: { id: product.id },
      data: { purchasable },
    });
  }

  async remove(id: string) {
    // ensure exists first
    await this.ensureProductExists(id);

    // Cascade delete without transaction
    await this.prisma.sKU.deleteMany({ where: { productId: id } });
    await this.prisma.physicalProduct.delete({ where: { id } });
  }

  private async ensureProductExists(id: string) {
    const exists = await this.prisma.physicalProduct.findUnique({
      where: { id },
    });
    if (!exists) throw new NotFoundException('Product not found');
  }

  private validateProductInput(input: CreateProductInput) {
    if (!input.title) throw new BadRequestException('title is required');
    if (!input.description)
      throw new BadRequestException('description is required');
    if (!Array.isArray(input.images) || input.images.length === 0)
      throw new BadRequestException('images is required and must be non-empty');
    if (!input.packaging)
      throw new BadRequestException('packaging is required');
    if (!input.shippingType)
      throw new BadRequestException('shippingType is required');
    this.validateStatus(input.status);
    if (!Array.isArray(input.skus) || input.skus.length === 0)
      throw new BadRequestException('skus is required and must be non-empty');
    for (const s of input.skus) {
      if (s.price == null)
        throw new BadRequestException('sku.price is required');
      if (s.quantity == null)
        throw new BadRequestException('sku.quantity is required');
      if (!Number.isFinite(s.price))
        throw new BadRequestException('sku.price must be a number');
      if (!Number.isInteger(s.quantity))
        throw new BadRequestException('sku.quantity must be an integer');
      if (!s.externalId)
        throw new BadRequestException('sku.externalId is required');
    }
  }

  private validateStatus(status: string) {
    if (!status) throw new BadRequestException('status is required');
    const allowed = ['DRAFT', 'PUBLISHED'];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `status must be one of ${allowed.join(', ')}`,
      );
    }
  }

  private async computePurchasableForProductId(
    tx: PrismaService | TxClient,
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
