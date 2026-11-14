# Flowly Backend

**Inventory, orders, and customer management for small businesses.**

Flowly is an Express API backed by PostgreSQL. It supports a mobile seller workflow: maintain a product catalog, create customer orders, track fulfillment, and review business metrics. Owners and employees share records scoped to the business owner.

## Features

- **Accounts and staff:** email-verified signup, JWT authentication, and owner-managed staff invitations.
- **Inventory:** product pricing, stock quantities, and archival of products with sales history.
- **Orders:** transactional stock deductions, fulfillment statuses, and purchase-time price/cost snapshots.
- **Customers:** contact details, recent orders, and delivered-order statistics.
- **Dashboard:** revenue, profit, average order value, low-stock items, and top-selling products.
- **AI marketing drafts:** Gemini-generated win-back and VIP messages, with sent, snoozed, and dismissed states. This API does not send WhatsApp messages.

This repository is an application backend in development. It is not a hosted demo or a claim of production readiness.

## Stack

| Layer              | Technology                    |
| ------------------ | ----------------------------- |
| HTTP API           | Node.js, Express 5            |
| Database           | PostgreSQL, Sequelize 6       |
| Authentication     | JSON Web Tokens, bcrypt       |
| Verification email | Brevo REST API                |
| AI drafts          | Google Generative AI SDK      |
| Checks             | Node.js test runner, Prettier |

## Getting started

Use Node.js 22 or newer, npm, and a PostgreSQL database that accepts TLS connections. The current database configuration requires TLS; a default local PostgreSQL installation without TLS will not connect.

```bash
git clone https://github.com/EngYoussefElghanam/flowly-backend.git
cd flowly-backend
npm ci
cp .env.example .env
```

Fill in `.env` using the [configuration reference](docs/README.md#configuration). Set a long, random `JWT_SECRET`. Signup requires a Brevo API key and a verified sender. The Gemini key is needed only when generating new marketing drafts.

```bash
npm run dev
```

For a normal start without file watching:

```bash
npm start
```

The server authenticates to PostgreSQL, runs `sequelize.sync()`, and then listens on `PORT` (default `3000`). It does not create the database itself. Startup can create missing tables; it is not a versioned migration system.

```bash
curl http://localhost:3000/
```

Expected response:

```json
{ "message": "Seller App Backend is Running!" }
```

## API at a glance

Most endpoints use `/api`; marketing uses `/marketing`. Protected requests require `Authorization: Bearer <token>`.

| Resource       | Base path                   | Capabilities                                         |
| -------------- | --------------------------- | ---------------------------------------------------- |
| Authentication | `/api/signup`, `/api/login` | Owner signup, verification, staff invitations, login |
| Users          | `/api/users`                | List employees, delete an authorized account         |
| Products       | `/api/products`             | Create, list, update, archive or delete              |
| Customers      | `/api/customers`            | Create, list, details, statistics                    |
| Orders         | `/api/orders`               | Create, list, details, update status                 |
| Dashboard      | `/api/dashboard`            | Business summary                                     |
| Settings       | `/api/settings`             | Read and update thresholds                           |
| Marketing      | `/marketing`                | Generate/read drafts and record actions              |

See the [API reference](docs/API.md) for every route, request examples, and important behavior.

## Development

```bash
npm test
npm run check
npm run format:check
npm run format
```

Tests exercise HTTP authentication boundaries and the settings failure path without connecting to a live database or contacting email/AI providers. They do not validate the full order lifecycle against PostgreSQL.

| Directory      | Responsibility                                         |
| -------------- | ------------------------------------------------------ |
| `routes/`      | URL registration and authentication middleware         |
| `controllers/` | Request handling and business operations               |
| `models/`      | Sequelize models and associations                      |
| `middleware/`  | JWT verification                                       |
| `util/`        | Database, email, and company-scope helpers             |
| `test/`        | Database-independent regression and HTTP tests         |
| `docs/`        | Setup details, API reference, and implementation notes |

## Implementation notes

Purchase-time cost and sale-price snapshots preserve historical order profit when catalog prices change. Cancelled and returned orders restore stock; reactivating them deducts stock again.

Dashboard totals currently include all order statuses, while the customer statistics endpoint counts delivered orders. Marketing counters are updated during order creation. These views have different semantics and should not be treated as reconciled financial reports.

See [current limitations](docs/README.md#current-limitations) before using the API with real business data.
