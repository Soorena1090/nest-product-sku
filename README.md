## Nest Products Backend

A simple products and SKUs REST API built with NestJS 11, Prisma Client for MongoDB, and Jest for testing. It exposes CRUD endpoints for `products` and `skus`, and uses MongoDB (replica set enabled) as the database.

### Overview
- **Framework**: NestJS 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`)
- **ORM/Client**: Prisma 6 (`@prisma/client`, `prisma`) with MongoDB provider
- **Database**: MongoDB (replica set `rs0` in Docker compose)
- **Validation**: `class-validator`, `class-transformer`
- **Tooling**: TypeScript, ESLint, Prettier
- **Testing**: Jest 30, Supertest, `mongodb-memory-server` for isolated tests

---

## Tech Stack
- **Runtime**: Node.js 18+
- **Language**: TypeScript 5
- **Framework**: NestJS 11
- **Database**: MongoDB
- **ORM/Client**: Prisma Client (MongoDB provider)
- **Validation**: class-validator, class-transformer
- **Testing**: Jest, Supertest, ts-jest, mongodb-memory-server
- **Linting/Formatting**: ESLint, Prettier
- **Containerization**: Docker, Docker Compose

---

## Project Structure
```
backend/
  src/
    product/           # Products module (controller/service/dto)
    sku/               # SKUs module (controller/service/dto)
    prisma/            # PrismaService integration for Nest
    main.ts            # App bootstrap (listens on port 3000)
  prisma/
    schema.prisma      # Prisma schema (MongoDB provider)
  docker-compose.yml   # MongoDB (replica set) + test app container
  Dockerfile.test      # Multi-stage Dockerfile used by compose test service
  package.json         # Scripts and dependencies
```

---

## Installation
1. Ensure you have Node.js 18+ and npm installed.
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file (see Environment Variables) or rely on Docker Compose which sets `DATABASE_URL` for the test app service.

---

## Environment Variables
Create a `.env` file at the project root (`backend/.env`) when running locally without Docker:

```env
# Mongo connection string; Prisma uses this for the MongoDB datasource
DATABASE_URL=mongodb://localhost:27017/nest_products?replicaSet=rs0
```

Notes:
- Prisma schema uses the `DATABASE_URL` env var. For MongoDB with Prisma, a replica set is recommended. The provided Docker Compose config starts MongoDB with replica set `rs0`.
- The app listens on port `3000` by default (set in `src/main.ts`).

---

## Prisma
This project uses Prisma Client with the MongoDB provider.

- Generate the Prisma Client (after installing dependencies):

```bash
npx prisma generate
```

- Push the schema to the database (MongoDB uses `db push`, not SQL migrations):

```bash
npx prisma db push
```

- Optional: open Prisma Studio to inspect data:

```bash
npx prisma studio
```

The schema models include `PhysicalProduct` and `SKU` with typical fields for a simple catalog.

---

## Running Locally

### With Docker (recommended for MongoDB replica set)
Start MongoDB (replica set) and the test container:

```bash
docker compose up -d
```

This will:
- Start `mongo` with replica set `rs0` and initialize it using `init-mongo-rs.sh`.
- Build a Node image as `app_test` container. By default, it tails and does not auto-run the app.

You can still run the Nest app on your host machine pointing to the Dockerized MongoDB via:

```bash
export DATABASE_URL="mongodb://localhost:27017/test_db?replicaSet=rs0"
npm run start:dev
```

Alternatively, `exec` into the `app_test` container if you want to run commands inside it:

```bash
docker compose exec app_test sh
# inside container
npm run start:dev
```

### Without Docker (local MongoDB)
If you have MongoDB locally, make sure it runs as a replica set (e.g., `rs0`). Then set your `.env` and run:

```bash
npm run start:dev
```

Production build:

```bash
npm run build
npm run start:prod
```

---

## API Endpoints

Base URL: `http://localhost:3000`

### Products
- `POST /products`
- `GET /products`
- `GET /products/:id`
- `PUT /products/:id`
- `DELETE /products/:id` (204 No Content)

### SKUs
- `POST /skus`
- `GET /skus`
- `GET /skus/:id`
- `PUT /skus/:id`
- `DELETE /skus/:id` (204 No Content)

Example request:

```bash
curl -X POST http://localhost:3000/skus \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "66f5b4d2a8c4f0a0f0a0f0a0",
    "price": 19.99,
    "quantity": 10,
    "externalId": "EXT-123",
    "image": "https://example.com/image.jpg"
  }'
```

---

## Testing

This project uses Jest and Supertest. Useful scripts:

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

Jest is configured in `package.json` with `ts-jest`. E2E configuration lives in `test/jest-e2e.json`.

---

## Linting & Formatting

```bash
# Lint and attempt auto-fixes
npm run lint

# Format with Prettier
npm run format
```

---

## Docker Details

- `docker-compose.yml` spins up:
  - `mongo`: MongoDB with replica set `rs0` (ports `27017:27017`)
  - `app_test`: Node 18-based image built from `Dockerfile.test`
- `init-mongo-rs.sh` initializes the replica set on container start.
- `Dockerfile.test` uses a multi-stage build and keeps the container running with `tail -f /dev/null` so you can exec in and run commands.

Common commands:

```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f mongo

# Exec into test app container
docker compose exec app_test sh

# Stop and remove services
docker compose down -v
```

---

## Scripts
Key npm scripts from `package.json`:

```bash
npm run start         # start app
npm run start:dev     # start in watch mode
npm run start:debug   # start with debugger
npm run start:prod    # run dist build
npm run build         # compile TypeScript to dist/
npm run lint          # ESLint
npm run format        # Prettier
npm test              # unit tests
npm run test:watch    # jest --watch
npm run test:cov      # coverage
npm run test:e2e      # e2e tests
```

---

## Notes & Tips
- For Prisma + MongoDB, use `db push` (not SQL migrations).
- Ensure your MongoDB instance runs as a replica set (required for some Prisma features and transactions).
- Default app port is `3000`; adjust in `src/main.ts` if needed.


