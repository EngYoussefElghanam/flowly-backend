# Developer Guide

[Project overview](../README.md) · [API reference](API.md)

## Configuration

Copy `.env.example` to `.env`. Never commit real credentials.

| Variable         | Purpose                          | Default / requirement           |
| ---------------- | -------------------------------- | ------------------------------- |
| `PORT`           | HTTP port                        | `3000`                          |
| `DB_HOST`        | PostgreSQL host                  | Required                        |
| `DB_PORT`        | PostgreSQL port                  | `5432`                          |
| `DB_USER`        | Database username                | Required                        |
| `DB_PASSWORD`    | Database password                | Required                        |
| `DB_NAME`        | Existing database name           | Required                        |
| `JWT_SECRET`     | Token signing secret             | Required for authentication     |
| `BREVO_API_KEY`  | Brevo transactional email access | Required for signup/invitations |
| `FROM_EMAIL`     | Verified Brevo sender address    | Required for signup/invitations |
| `FROM_NAME`      | Verification sender name         | `Flowly Security` if unset      |
| `GEMINI_API_KEY` | AI marketing generation          | Required for new AI drafts      |

PostgreSQL is selected in `util/db.js`; `DB_DIALECT` is not used. The existing connection requires TLS but disables server certificate verification. Configure trusted certificate verification before production deployment. This cleanup retains that connection behavior.

## Application structure

`app.js` registers middleware and routes. `models/index.js` defines associations. When executed directly, the app authenticates to the database, synchronizes models, and starts listening. Importing the app does not connect or open a listener, allowing HTTP tests without database access.

Each business is identified by its owner's user ID. `util/company.js` returns an owner's own ID or an employee's `ownerId`; controllers use that value to scope business queries. Sharing this helper does not replace endpoint-level authorization checks.

Order creation uses a database transaction and product row locks. Order items store quantity, sale price, and cost at purchase. Deleting a product with sales history archives it instead of removing its historical reference.

## Verification

- `npm test`: HTTP smoke tests and a settings error regression test; no provider credentials or database required.
- `npm run check`: syntax-check all application and test JavaScript.
- `npm run format:check`: check consistent formatting.

A full integration run additionally needs a disposable PostgreSQL database, working email verification, and optional AI credentials. Check signup, login, customer/product creation, order creation, cancellation/restocking, and cross-company access using separate owner accounts. Do not run destructive lifecycle checks against production data.

## Current limitations

- Startup uses `sequelize.sync()`; there is no versioned migration workflow.
- Request validation and role restrictions need a dedicated review. Authentication alone does not guarantee owner-only access to each operation.
- Email verification has no application-level attempt limit or rate limiting.
- CORS currently allows all origins.
- Some controller errors expose internal error information, and error response shapes vary.
- Employee listing currently returns model records without an explicit safe-field projection; review this before exposing the endpoint to real users.
- Monetary values use floating-point fields rather than fixed-precision decimal fields.
- Dashboard revenue/profit includes all statuses; customer statistics count only delivered orders. Stored customer counters are not reconciled on cancellation.
- Archived products remain in the product list; clients must account for `isArchived`.
- Reading marketing opportunities can call Gemini and write new records. Generated offers are currently hardcoded and require review. Recording `SENT` does not send a message.
- Live database, email delivery, and Gemini integration are not covered by the included tests.

These notes describe current implementation behavior, not guarantees of security or production readiness.
