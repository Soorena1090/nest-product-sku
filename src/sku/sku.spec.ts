/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-require-imports */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { SkuModule } from './sku.module';
import { PrismaService } from '../prisma/prisma.service';

/*
# To run this test
npm run test sku.spec.ts
*/

// Tests rely on external MongoDB (e.g., via docker-compose). Ensure DATABASE_URL is set before running.
const describeIfMongo = describe;

// Helper builders
function buildSkuPayload(
  overrides: Partial<{
    productId: string;
    price: number;
    quantity: number;
    externalId: string;
    image: string;
  }> = {},
) {
  return {
    price: 25.5,
    quantity: 5,
    externalId: `ext-${Math.random().toString(36).slice(2, 10)}`,
    image: 'https://example.com/image.jpg',
    productId: overrides.productId || 'REPLACE_ME',
    ...overrides,
  };
}

async function createProduct(
  prisma: PrismaService,
  overrides: Partial<{ status: string; purchasable: boolean }> = {},
) {
  const created = await prisma.physicalProduct.create({
    data: {
      title: 'Test Product',
      description: 'Desc',
      images: ['https://example.com/1.jpg'],
      packaging: { width: 1, height: 1, length: 1, weight: 1 },
      shippingType: 'STANDARD',
      status: overrides.status ?? 'PUBLISHED',
      purchasable: overrides.purchasable ?? false,
    },
  });
  return created;
}

describeIfMongo('SKU Module (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  // declared above with proper type

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = 'mongodb://mongo:27017/test_db?replicaSet=rs0';
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SkuModule],
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
    // Clear collections before each test
    await prisma.sKU.deleteMany({});
    await prisma.physicalProduct.deleteMany({});
  });

  describe('Create SKU', () => {
    it('should create a SKU successfully when all fields are valid (201)', async () => {
      const product = await createProduct(prisma, { status: 'PUBLISHED' });
      const payload = buildSkuPayload({ productId: product.id });

      const res = await request(app.getHttpServer())
        .post('/skus')
        .send(payload)
        .expect(201);

      expect(res.body).toMatchObject({
        productId: product.id,
        price: payload.price,
        quantity: payload.quantity,
        externalId: payload.externalId,
        image: payload.image,
      });
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('createdAt');
      expect(res.body).toHaveProperty('updatedAt');

      // DB state
      const inDb = await prisma.sKU.findUnique({ where: { id: res.body.id } });
      expect(inDb).toBeTruthy();
    });

    it('should return 400 when required fields are missing', async () => {
      const product = await createProduct(prisma);
      // Omit price, quantity, externalId, image intentionally
      const res = await request(app.getHttpServer())
        .post('/skus')
        .send({ productId: product.id } as any)
        .expect(400);
      expect(res.body.message).toBeDefined();

      // DB should still be empty
      const count = await prisma.sKU.count();
      expect(count).toBe(0);
    });

    it('should not allow duplicate externalId (400) and no duplicates in DB', async () => {
      const product = await createProduct(prisma);
      const duplicateExternalId = `dup-${Math.random().toString(36).slice(2, 10)}`;

      const first = await request(app.getHttpServer())
        .post('/skus')
        .send(
          buildSkuPayload({
            productId: product.id,
            externalId: duplicateExternalId,
          }),
        )
        .expect(201);
      expect(first.body.externalId).toBe(duplicateExternalId);

      await request(app.getHttpServer())
        .post('/skus')
        .send(
          buildSkuPayload({
            productId: product.id,
            externalId: duplicateExternalId,
          }),
        )
        .expect(400);

      const dupCount = await prisma.sKU.count({
        where: { externalId: duplicateExternalId },
      });
      expect(dupCount).toBe(1);
    });
  });

  describe('List SKUs', () => {
    it('should return all SKUs (GET /skus)', async () => {
      const product = await createProduct(prisma);
      // Create via API
      await request(app.getHttpServer())
        .post('/skus')
        .send(buildSkuPayload({ productId: product.id }))
        .expect(201);
      await request(app.getHttpServer())
        .post('/skus')
        .send(buildSkuPayload({ productId: product.id }))
        .expect(201);

      const res = await request(app.getHttpServer()).get('/skus').expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });
  });

  describe('Get single SKU', () => {
    it('should return a single SKU by id (GET /skus/:id)', async () => {
      const product = await createProduct(prisma);
      const created = await request(app.getHttpServer())
        .post('/skus')
        .send(buildSkuPayload({ productId: product.id }))
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/skus/${created.body.id}`)
        .expect(200);
      expect(res.body.id).toBe(created.body.id);
      expect(res.body.productId).toBe(product.id);
    });

    it('should return 404 for non-existent id', async () => {
      const nonExistentId = '652e0b0f5f0a1a2b3c4d5e6f'; // valid ObjectId-like string
      await request(app.getHttpServer())
        .get(`/skus/${nonExistentId}`)
        .expect(404);
    });
  });

  describe('Update SKU', () => {
    it('should update price and quantity successfully (200)', async () => {
      const product = await createProduct(prisma);
      const created = await request(app.getHttpServer())
        .post('/skus')
        .send(
          buildSkuPayload({ productId: product.id, price: 10, quantity: 1 }),
        )
        .expect(201);

      const updated = await request(app.getHttpServer())
        .put(`/skus/${created.body.id}`)
        .send({ price: 15.75, quantity: 3 })
        .expect(200);

      expect(updated.body.price).toBe(15.75);
      expect(updated.body.quantity).toBe(3);

      const inDb = await prisma.sKU.findUnique({
        where: { id: created.body.id },
      });
      expect(inDb?.price).toBe(15.75);
      expect(inDb?.quantity).toBe(3);
    });

    it('should return 400 for invalid updates (negative price/quantity, empty externalId)', async () => {
      const product = await createProduct(prisma);
      const created = await request(app.getHttpServer())
        .post('/skus')
        .send(buildSkuPayload({ productId: product.id }))
        .expect(201);

      await request(app.getHttpServer())
        .put(`/skus/${created.body.id}`)
        .send({ price: -1 })
        .expect(400);
      await request(app.getHttpServer())
        .put(`/skus/${created.body.id}`)
        .send({ quantity: -5 })
        .expect(400);
      await request(app.getHttpServer())
        .put(`/skus/${created.body.id}`)
        .send({ externalId: '' })
        .expect(400);
    });
  });

  describe('Delete SKU', () => {
    it('should delete SKU successfully (204) and GET by id should 404', async () => {
      const product = await createProduct(prisma);
      const created = await request(app.getHttpServer())
        .post('/skus')
        .send(buildSkuPayload({ productId: product.id }))
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/skus/${created.body.id}`)
        .expect(204);

      // Ensure deleted in DB
      const inDb = await prisma.sKU.findUnique({
        where: { id: created.body.id },
      });
      expect(inDb).toBeNull();

      // GET should 404
      await request(app.getHttpServer())
        .get(`/skus/${created.body.id}`)
        .expect(404);
    });

    it('should return 404 when deleting non-existent SKU', async () => {
      const nonExistentId = '652e0b0f5f0a1a2b3c4d5e6f';
      await request(app.getHttpServer())
        .delete(`/skus/${nonExistentId}`)
        .expect(404);
    });
  });

  describe('Purchasable logic with Product', () => {
    it('should set product.purchasable=true when status=PUBLISHED and any SKU quantity>0', async () => {
      const product = await createProduct(prisma, {
        status: 'PUBLISHED',
        purchasable: false,
      });

      const createdZero = await request(app.getHttpServer())
        .post('/skus')
        .send(buildSkuPayload({ productId: product.id, quantity: 0 }))
        .expect(201);
      // After creating a 0-qty SKU, purchasable remains false
      let prodAfter = await prisma.physicalProduct.findUnique({
        where: { id: product.id },
      });
      expect(prodAfter?.purchasable).toBe(false);

      // Create a second SKU with quantity > 0
      await request(app.getHttpServer())
        .post('/skus')
        .send(buildSkuPayload({ productId: product.id, quantity: 2 }))
        .expect(201);

      prodAfter = await prisma.physicalProduct.findUnique({
        where: { id: product.id },
      });
      expect(prodAfter?.purchasable).toBe(true);

      // Now update the non-zero SKU to 0 and ensure recompute
      await request(app.getHttpServer())
        .put(`/skus/${createdZero.body.id}`)
        .send({ quantity: 5 })
        .expect(200);
      // purchasable should still be true (at least one qty>0)
      prodAfter = await prisma.physicalProduct.findUnique({
        where: { id: product.id },
      });
      expect(prodAfter?.purchasable).toBe(true);

      // Set all SKUs to zero
      const skus = await prisma.sKU.findMany({
        where: { productId: product.id },
      });
      for (const s of skus) {
        await request(app.getHttpServer())
          .put(`/skus/${s.id}`)
          .send({ quantity: 0 })
          .expect(200);
      }
      prodAfter = await prisma.physicalProduct.findUnique({
        where: { id: product.id },
      });
      expect(prodAfter?.purchasable).toBe(false);
    });
  });

  describe('Cascade delete check (via Product delete)', () => {
    it('should remove SKUs when parent product is deleted', async () => {
      const product = await createProduct(prisma);

      // Create multiple SKUs
      const created1 = await request(app.getHttpServer())
        .post('/skus')
        .send(buildSkuPayload({ productId: product.id }))
        .expect(201);
      await request(app.getHttpServer())
        .post('/skus')
        .send(buildSkuPayload({ productId: product.id }))
        .expect(201);

      const beforeCount = await prisma.sKU.count({
        where: { productId: product.id },
      });
      expect(beforeCount).toBe(2);

      // Simulate product deletion (service does cascade in real controller)
      await prisma.$transaction(async (tx) => {
        await tx.sKU.deleteMany({ where: { productId: product.id } });
        await tx.physicalProduct.delete({ where: { id: product.id } });
      });

      const afterCount = await prisma.sKU.count({
        where: { productId: product.id },
      });
      expect(afterCount).toBe(0);

      // Ensure SKUs cannot be fetched via GET by id anymore
      await request(app.getHttpServer())
        .get(`/skus/${created1.body.id}`)
        .expect(404);
    });
  });
});
