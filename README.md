# 🚀 Nest Products & Auth Backend

A full-featured REST API built with **NestJS 11**, **Prisma Client for MongoDB**, and **JWT-based Authentication**.  
It provides secure CRUD operations for `products` and `skus`, plus user registration, login, and role-based access control (RBAC).

---

## 🧭 Overview

- **Framework**: NestJS 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`)
- **Database**: MongoDB (replica set `rs0` in Docker Compose)
- **ORM**: Prisma 6 (`@prisma/client`, `prisma`) with MongoDB provider
- **Authentication**: JWT, Guards, Role-based Access Control (RBAC)
- **Validation**: `class-validator`, `class-transformer`
- **Testing**: Jest, Supertest, `mongodb-memory-server`
- **Tooling**: TypeScript, ESLint, Prettier, Docker

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|-------------|
| Runtime | Node.js 18+ |
| Language | TypeScript 5 |
| Framework | NestJS 11 |
| Database | MongoDB (Replica Set `rs0`) |
| ORM | Prisma Client (MongoDB provider) |
| Auth | JWT, Passport, Role Guards |
| Validation | class-validator, class-transformer |
| Testing | Jest, Supertest, ts-jest |
| Formatting | ESLint, Prettier |
| Containerization | Docker, Docker Compose |

---

## 🗂️ Project Structure

backend/
src/
auth/ # Auth module (JWT, Guards, Decorators)
dto/ # DTOs for Register/Login
jwt.strategy.ts # JWT validation strategy
jwt-auth.guard.ts# Guard for protecting routes
roles.guard.ts # Role-based access control
roles.decorator.ts# Custom roles decorator
product/ # Products module (controller/service/dto)
sku/ # SKUs module (controller/service/dto)
prisma/ # PrismaService integration for Nest
main.ts # App bootstrap (listens on port 3000)
prisma/
schema.prisma # Prisma schema (MongoDB provider)
docker-compose.yml # MongoDB (replica set) + test app container
Dockerfile.test # Multi-stage Dockerfile used by compose test service
package.json # Scripts and dependencies

yaml
Copy code

---

## ⚙️ Installation

1. Ensure you have Node.js 18+ and npm installed.
2. Install dependencies:
   ```bash
   npm install
Create a .env file (see below) or rely on Docker Compose which sets DATABASE_URL.

🌍 Environment Variables
Create a .env file at the project root (backend/.env):

env
Copy code
# Mongo connection string; Prisma uses this for MongoDB datasource
DATABASE_URL=mongodb://localhost:27017/nest_products?replicaSet=rs0

# JWT secret key for signing tokens
JWT_SECRET=mysecretkey
JWT_EXPIRES_IN=1d
🧩 Prisma Commands
bash
Copy code
# Generate Prisma Client
npx prisma generate

# Push schema to MongoDB
npx prisma db push

# Open Prisma Studio (GUI)
npx prisma studio
🧑‍💻 Running Locally
With Docker (recommended)
bash
Copy code
docker compose up -d
This will:

Start mongo with replica set rs0

Initialize replica set with init-mongo-rs.sh

Build Node image as app_test container

You can run the app locally connected to Docker MongoDB:

bash
Copy code
export DATABASE_URL="mongodb://localhost:27017/test_db?replicaSet=rs0"
npm run start:dev
🔐 Authentication & Authorization
Overview
This project uses JWT-based authentication and Role-based access control (RBAC).

AuthService handles user registration & login.

JwtStrategy validates tokens for protected routes.

JwtAuthGuard restricts routes to authenticated users.

RolesGuard checks user roles (e.g., admin, user).

@Roles() decorator is used on controllers to define route-level access.

Endpoints
Register
POST /auth/register

Registers a new user.

Request:

bash
Copy code
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "strongpassword",
    "role": "user"
  }'
Response:

json
Copy code
{
  "message": "User registered successfully",
  "user": {
    "id": "66f7c0a2e9b1b7a5e1e34f9a",
    "email": "user@example.com",
    "role": "user"
  }
}
Login
POST /auth/login

Authenticates a user and returns a JWT token.

Request:

bash
Copy code
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "strongpassword"
  }'
Response:

json
Copy code
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI..."
}
Use this token in the Authorization header for protected routes:

makefile
Copy code
Authorization: Bearer <token>
Protected Example
bash
Copy code
curl -X GET http://localhost:3000/products \
  -H "Authorization: Bearer <your_jwt_token>"
Admin-only routes use @Roles('admin') decorator combined with RolesGuard.

🛍️ API Endpoints (Main)
Base URL: http://localhost:3000

Products
Method	Endpoint	Description
POST	/products	Create new product
GET	/products	Get all products
GET	/products/:id	Get product by ID
PUT	/products/:id	Update product
DELETE	/products/:id	Delete product

SKUs
Method	Endpoint	Description
POST	/skus	Create new SKU
GET	/skus	Get all SKUs
GET	/skus/:id	Get SKU by ID
PUT	/skus/:id	Update SKU
DELETE	/skus/:id	Delete SKU

🧪 Testing
bash
Copy code
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# E2E tests
npm run test:e2e
Jest uses ts-jest and mongodb-memory-server for isolated tests.

🧹 Linting & Formatting
bash
Copy code
npm run lint     # Lint and auto-fix
npm run format   # Format with Prettier
🐳 Docker Details
docker-compose.yml spins up:

mongo: MongoDB replica set rs0 (port 27017)

app_test: Node 18-based container (via Dockerfile.test)

init-mongo-rs.sh initializes replica set.

The container stays alive using tail -f /dev/null.

Common Commands:

bash
Copy code
docker compose up -d       # Start
docker compose logs -f     # View logs
docker compose exec app_test sh  # Access container shell
docker compose down -v     # Stop & clean volumes
🧰 NPM Scripts
bash
Copy code
npm run start         # Start app
npm run start:dev     # Dev mode (watch)
npm run start:debug   # Debug mode
npm run start:prod    # Run dist build
npm run build         # Compile TypeScript
npm run lint          # ESLint
npm run format        # Prettier
npm test              # Unit tests
npm run test:e2e      # End-to-end tests
📝 Notes & Tips
For Prisma + MongoDB, use db push (not SQL migrations).

MongoDB must run as a replica set for Prisma transactions.

Default port: 3000 (change in src/main.ts).

Protect routes using JwtAuthGuard and @Roles() decorator.

Tokens expire as configured in .env (JWT_EXPIRES_IN).

