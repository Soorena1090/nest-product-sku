/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ProductModule } from './product.module';
import { PrismaService } from '../prisma/prisma.service';

// Tests rely on external MongoDB (e.g., via docker-compose). Ensure DATABASE_URL is set before running.
const describeIfMongo = describe;

// Helper builders
function buildSku(
  overrides: Partial<{
    price: number;
    quantity: number;
    externalId: string;
    image?: string | null;
  }> = {},
) {
  return {
    price: 19.99,
    quantity: 10,
    externalId: `sku-${Math.random().toString(36).slice(2, 8)}`,
    image: null,
    ...overrides,
  };
}

function buildProductPayload(
  overrides: Partial<{
    title: string;
    description: string;
    images: string[];
    packaging: {
      width?: number | null;
      height?: number | null;
      length?: number | null;
      weight?: number | null;
    };
    shippingType: string;
    status: string;
    skus: Array<ReturnType<typeof buildSku>>;
  }> = {},
) {
  return {
    title: 'Sample Product',
    description: 'A great physical product',
    images: ['https://example.com/1.jpg'],
    packaging: { width: 10, height: 5, length: 20, weight: 1.5 },
    shippingType: 'STANDARD',
    status: 'DRAFT' as const,
    skus: [buildSku()],
    ...overrides,
  };
}

describeIfMongo('ProductModule (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    // If DATABASE_URL is not provided, default to docker-compose service name
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = 'mongodb://mongo:27017/test_db?replicaSet=rs0';
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ProductModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(async () => {
    // Clean collections between tests
    await prisma.sKU.deleteMany({});
    await prisma.physicalProduct.deleteMany({});
  });

  describe('Create Product', () => {
    it('should create a product successfully', async () => {
      const payload = buildProductPayload({ status: 'PUBLISHED' });
      const res = await request(app.getHttpServer())
        .post('/products')
        .send(payload)
        .expect(201);

      expect(res.body).toMatchObject({
        title: payload.title,
        description: payload.description,
        images: payload.images,
        shippingType: payload.shippingType,
        status: 'PUBLISHED',
        purchasable: true,
      });
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('createdAt');
      expect(res.body).toHaveProperty('updatedAt');
    });

    it('should fail to create product when mandatory fields are missing', async () => {
      const payload = buildProductPayload({
        title: '', // invalid
        description: '', // invalid
        images: [], // invalid
        shippingType: '', // invalid
        // packaging missing entirely
        // skus missing entirely
      } as any);

      const res = await request(app.getHttpServer())
        .post('/products')
        .send({
          title: payload.title,
          description: payload.description,
          images: payload.images,
          shippingType: payload.shippingType,
          status: 'DRAFT',
          // packaging: missing
          // skus: missing
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('should reject invalid status', async () => {
      const payload = buildProductPayload({ status: 'INVALID_STATUS' });
      const res = await request(app.getHttpServer())
        .post('/products')
        .send(payload)
        .expect(400);
      expect(
        Array.isArray(res.body.message) || typeof res.body.message === 'string',
      ).toBeTruthy();
    });

    it('should create product and skip duplicate SKU (no rollback)', async () => {
      // Prepare an existing SKU to trigger uniqueness violation on externalId
      const existingSkuExternalId = `dup-${Math.random().toString(36).slice(2, 8)}`;
      const firstProduct = await request(app.getHttpServer())
        .post('/products')
        .send(
          buildProductPayload({
            status: 'DRAFT',
            skus: [buildSku({ externalId: existingSkuExternalId })],
          }),
        )
        .expect(201);
      expect(firstProduct.body).toHaveProperty('id');

      // Now attempt to create a product where one SKU conflicts on unique externalId
      const payload = buildProductPayload({
        status: 'PUBLISHED',
        skus: [buildSku(), buildSku({ externalId: existingSkuExternalId })],
      });

      const created = await request(app.getHttpServer())
        .post('/products')
        .send(payload)
        // Service uses createMany with skipDuplicates, so product is created successfully
        .expect(201);

      // Verify product exists
      const fetched = await request(app.getHttpServer())
        .get(`/products/${created.body.id}`)
        .expect(200);
      expect(fetched.body.title).toBe(payload.title);

      // Verify SKUs for the new product: duplicate externalId should be skipped
      const skusForProduct = await prisma.sKU.findMany({
        where: { productId: created.body.id },
      });
      expect(Array.isArray(skusForProduct)).toBe(true);
      expect(skusForProduct.length).toBe(1);
      // Ensure the skipped one (duplicate externalId) was not created for this product
      const dupForThisProduct = await prisma.sKU.findMany({
        where: {
          productId: created.body.id,
          externalId: existingSkuExternalId,
        },
      });
      expect(dupForThisProduct.length).toBe(0);
    });
  });

  describe('Read Products', () => {
    it('should get all products', async () => {
      await request(app.getHttpServer())
        .post('/products')
        .send(buildProductPayload({ title: 'Listable A' }))
        .expect(201);

      await request(app.getHttpServer())
        .post('/products')
        .send(buildProductPayload({ title: 'Listable B' }))
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/products')
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should get single product by id', async () => {
      const created = await request(app.getHttpServer())
        .post('/products')
        .send(buildProductPayload({ title: 'Single Fetch' }))
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/products/${created.body.id}`)
        .expect(200);
      expect(res.body.title).toBe('Single Fetch');
    });
  });

  describe('Update Product', () => {
    it('should update product title or description successfully', async () => {
      const created = await request(app.getHttpServer())
        .post('/products')
        .send(
          buildProductPayload({ title: 'Before Update', description: 'Old' }),
        )
        .expect(201);

      const updated = await request(app.getHttpServer())
        .put(`/products/${created.body.id}`)
        .send({ title: 'After Update', description: 'New' })
        .expect(200);

      expect(updated.body.title).toBe('After Update');
      expect(updated.body.description).toBe('New');
    });

    it('should fail to update when providing invalid data', async () => {
      const created = await request(app.getHttpServer())
        .post('/products')
        .send(buildProductPayload({ title: 'Update Invalid' }))
        .expect(201);

      await request(app.getHttpServer())
        .put(`/products/${created.body.id}`)
        .send({ title: '' }) // invalid
        .expect(400);

      await request(app.getHttpServer())
        .put(`/products/${created.body.id}`)
        .send({ images: [] }) // invalid
        .expect(400);
    });
  });

  describe('Delete Product', () => {
    it('should delete product successfully', async () => {
      const created = await request(app.getHttpServer())
        .post('/products')
        .send(buildProductPayload({ title: 'To Delete' }))
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/products/${created.body.id}`)
        .expect(204);
    });

    it('should fail to get deleted product (404)', async () => {
      const created = await request(app.getHttpServer())
        .post('/products')
        .send(buildProductPayload({ title: 'Delete Then 404' }))
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/products/${created.body.id}`)
        .expect(204);
      await request(app.getHttpServer())
        .get(`/products/${created.body.id}`)
        .expect(404);
    });

    it('should cascade delete related SKUs', async () => {
      const created = await request(app.getHttpServer())
        .post('/products')
        .send(buildProductPayload({ skus: [buildSku(), buildSku()] }))
        .expect(201);

      // There should be 2 SKUs for this product
      const beforeCount = await prisma.sKU.count({
        where: { productId: created.body.id },
      });
      expect(beforeCount).toBe(2);

      await request(app.getHttpServer())
        .delete(`/products/${created.body.id}`)
        .expect(204);

      const afterCount = await prisma.sKU.count({
        where: { productId: created.body.id },
      });
      expect(afterCount).toBe(0);
    });
  });

  describe('Purchasable Logic', () => {
    it('purchasable = false when status=DRAFT regardless of SKUs', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .send(
          buildProductPayload({
            status: 'DRAFT',
            skus: [buildSku({ quantity: 5 })],
          }),
        )
        .expect(201);
      expect(res.body.purchasable).toBe(false);
    });

    it('purchasable = false when status=PUBLISHED but all SKUs have quantity=0', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .send(
          buildProductPayload({
            status: 'PUBLISHED',
            skus: [buildSku({ quantity: 0 })],
          }),
        )
        .expect(201);
      expect(res.body.purchasable).toBe(false);
    });

    it('purchasable = true when status=PUBLISHED and at least one SKU has quantity>0', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .send(
          buildProductPayload({
            status: 'PUBLISHED',
            skus: [buildSku({ quantity: 0 }), buildSku({ quantity: 3 })],
          }),
        )
        .expect(201);
      expect(res.body.purchasable).toBe(true);
    });
  });
});

/*
# How to run
npm run test product.spec.ts
*/
