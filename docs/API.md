# API Reference

[Project overview](../README.md) · [Developer guide](README.md)

Local base URL: `http://localhost:3000`. Send JSON with `Content-Type: application/json`. Protected endpoints require `Authorization: Bearer <token>`.

## Routes

| Method | Path                       | Authentication      | Purpose                                                |
| ------ | -------------------------- | ------------------- | ------------------------------------------------------ |
| GET    | `/`                        | Public              | Running-server response                                |
| POST   | `/api/signup/initiate`     | Public              | Begin owner signup and email verification              |
| POST   | `/api/signup/verify`       | Public              | Verify code and create account                         |
| POST   | `/api/login`               | Public              | Obtain a JWT                                           |
| POST   | `/api/signup/invite`       | Owner               | Begin employee invitation                              |
| GET    | `/api/users/employees`     | JWT                 | List employees linked to the caller                    |
| DELETE | `/api/users/:id`           | Owner authorization | Delete an employee or the owner's own business account |
| GET    | `/api/products`            | JWT                 | List company products, including archived records      |
| POST   | `/api/products`            | JWT                 | Create product                                         |
| PUT    | `/api/products/:id`        | JWT                 | Update product                                         |
| DELETE | `/api/products/:id`        | JWT                 | Archive if sold previously; otherwise delete           |
| GET    | `/api/customers`           | JWT                 | List customers                                         |
| POST   | `/api/customers`           | JWT                 | Create customer                                        |
| GET    | `/api/customers/:id`       | JWT                 | Customer details with recent orders                    |
| GET    | `/api/customers/:id/stats` | JWT                 | Delivered-order statistics                             |
| GET    | `/api/orders`              | JWT                 | List company orders                                    |
| POST   | `/api/orders`              | JWT                 | Create order and deduct stock                          |
| GET    | `/api/orders/:id`          | JWT                 | Order details                                          |
| PATCH  | `/api/orders/:id`          | JWT                 | Update fulfillment status and optional tracking number |
| GET    | `/api/dashboard`           | JWT                 | Company summary                                        |
| GET    | `/api/settings`            | JWT                 | Caller account thresholds                              |
| PUT    | `/api/settings`            | JWT                 | Update caller account thresholds                       |
| GET    | `/marketing/opportunities` | JWT                 | Read or generate marketing drafts                      |
| POST   | `/marketing/action/:id`    | JWT                 | Record draft action                                    |

“JWT” describes the route middleware, not an owner-only permission guarantee. Account deletion can remove associated business data and is not part of the walkthrough below.

## Example workflow

Use a test account and a disposable database. Example IDs must be replaced with IDs returned by your own requests.

### 1. Register an owner

`POST /api/signup/initiate`

```json
{
  "name": "Demo Owner",
  "email": "your-test-email@example.com",
  "password": "replace-with-a-strong-password",
  "phone": "01000000000"
}
```

Use a real inbox you control: signup validates the domain's MX records and sends a verification code through Brevo. Public signup always creates an owner; role and owner ID are not taken from the request.

`POST /api/signup/verify`

```json
{ "email": "your-test-email@example.com", "code": "123456" }
```

Replace the example code with the emailed code, which expires after ten minutes. Successful verification returns `token`, `userId`, `name`, `email`, and `role` with HTTP 201. Tokens expire after 30 days.

For subsequent sessions, `POST /api/login` accepts `email` and `password`. Use its returned token on protected requests.

### 2. Create a product

`POST /api/products`

```json
{
  "name": "Notebook",
  "costPrice": 40,
  "sellPrice": 65,
  "stockQuantity": 20
}
```

The response contains a `product` object. Product updates use the same fields via `PUT /api/products/:id`.

### 3. Create a customer

`POST /api/customers`

```json
{
  "name": "Demo Customer",
  "phone": "01000000001",
  "city": "Alexandria",
  "address": "Demo address"
}
```

All four fields are required. Phone uniqueness is scoped to the company. The response contains a `customer` object.

### 4. Create an order

`POST /api/orders`

```json
{
  "customerId": 1,
  "products": [{ "id": 1, "quantity": 2 }],
  "courierName": "Demo Courier",
  "notes": "Test order"
}
```

Replace both IDs. Prices come from the product records. On success, the response contains `orderId`, `totalAmount`, and `profit`; stock is deducted in a transaction. The initial status is `NEW`.

### 5. Update fulfillment

`PATCH /api/orders/1`

```json
{ "status": "PACKED", "trackingNumber": "DEMO-001" }
```

Defined statuses: `NEW`, `PACKED`, `WITH_COURIER`, `DELIVERED`, `CANCELLED`, `RETURNED`.

Changing an active order to cancelled/returned restores stock. Moving between cancelled and returned does not restock twice. Reactivating a cancelled/returned order deducts stock again and checks availability. The implementation does not enforce a strict sequential fulfillment state machine.

## Settings and marketing

`PUT /api/settings` accepts `inactiveThreshold`, `vipOrderThreshold`, and `lowStockThreshold`. These update the caller's record; dashboard and marketing calculations use the owner's settings.

`GET /marketing/opportunities` may generate new Gemini drafts and save them. Generation uses customer names and favorite items, with fixed promotional offers. Review drafts before communicating them to customers.

`POST /marketing/action/:id` accepts one of these actions:

```json
{ "action": "SNOOZED" }
```

| Action     | Effect                                                                                |
| ---------- | ------------------------------------------------------------------------------------- |
| `SENT`     | Marks the draft sent and updates the customer's marketing timestamp; sends no message |
| `SNOOZED`  | Snoozes the draft for two days                                                        |
| `REJECTED` | Stores status `DISMISSED`                                                             |

## Response conventions

Lists for products, customers, and orders use `data`; marketing uses `opportunities`. Other responses vary by endpoint. Missing/invalid JWTs return HTTP 401. Controller failures are not yet normalized into a common JSON error schema. Clients should check the status and content type before assuming a specific response shape.
