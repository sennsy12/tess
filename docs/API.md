# Tess API Reference

All endpoints are prefixed with `/api`.

Responses follow a consistent envelope:

```json
{ "status": "error", "error": "message" }            // errors
{ "data": [...], "pagination": { ... } }              // paginated lists
{ "data": { ... } }                                    // single resource
```

## Authentication

All requests (except `/auth/login*` and `/health`) require a `Bearer` token in the `Authorization` header.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/login` | Public (rate-limited) | Login for admin / analyse users. Body: `{ username, password }` |
| `POST` | `/auth/login-kunde` | Public (rate-limited) | Login for customer users. Body: `{ kundenr, password }` |
| `GET` | `/auth/verify` | Token | Verify the current JWT token is still valid |

## Users (admin only)

| Method | Path | Middleware | Description |
|--------|------|-----------|-------------|
| `GET` | `/users` | `authMiddleware`, `roleGuard('admin')` | List all users (paginated) |
| `GET` | `/users/:id` | `authMiddleware`, `roleGuard('admin')` | Get a single user by ID |
| `POST` | `/users` | `authMiddleware`, `roleGuard('admin')`, `validate(createUserSchema)` | Create a new user |
| `PUT` | `/users/:id` | `authMiddleware`, `roleGuard('admin')`, `validate(updateUserSchema)` | Update user fields |
| `DELETE` | `/users/:id` | `authMiddleware`, `roleGuard('admin')` | Delete a user permanently |

## Orders

| Method | Path | Middleware | Description |
|--------|------|-----------|-------------|
| `GET` | `/orders` | `authMiddleware`, `validate(orderQuerySchema)` | List orders (filtered, paginated, role-scoped) |
| `GET` | `/orders/:ordrenr` | `authMiddleware` | Get a single order with its lines |
| `GET` | `/orders/search/references` | `authMiddleware` | Search across order reference fields |

## Order Lines

| Method | Path | Middleware | Description |
|--------|------|-----------|-------------|
| `GET` | `/orderlines/order/:ordrenr` | `authMiddleware` | Get paginated lines for an order |
| `POST` | `/orderlines` | `authMiddleware`, `roleGuard('admin')` | Create a new order line |
| `PUT` | `/orderlines/:ordrenr/:linjenr` | `authMiddleware`, `roleGuard('admin')` | Update an order line |
| `DELETE` | `/orderlines/:ordrenr/:linjenr` | `authMiddleware`, `roleGuard('admin')` | Delete an order line |
| `PUT` | `/orderlines/:ordrenr/:linjenr/references` | `authMiddleware`, `roleGuard('admin')` | Upsert reference fields for a line |

## Statistics

All statistics endpoints require `authMiddleware` and accept validated query parameters (date range, pagination, etc.).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/statistics/summary` | High-level dashboard KPIs |
| `GET` | `/statistics/by-kunde` | Revenue / order count grouped by customer |
| `GET` | `/statistics/by-varegruppe` | Statistics grouped by product group |
| `GET` | `/statistics/by-vare` | Statistics grouped by individual product |
| `GET` | `/statistics/by-lager` | Statistics grouped by warehouse |
| `GET` | `/statistics/by-firma` | Statistics grouped by company |
| `GET` | `/statistics/time-series` | Orders over time (day / week / month / year) |
| `GET` | `/statistics/custom` | Configurable metric + dimension (Advanced Analytics) |
| `GET` | `/statistics/batch` | Batch multiple stat queries in one call |

## Pricing

### Customer Groups

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/pricing/groups` | List all customer groups |
| `POST` | `/pricing/groups` | Create a customer group |
| `PUT` | `/pricing/groups/:id` | Update a customer group |
| `DELETE` | `/pricing/groups/:id` | Delete a customer group |
| `PUT` | `/pricing/groups/:id/customers/:kundenr` | Assign customer to group |
| `DELETE` | `/pricing/groups/customers/:kundenr` | Remove customer from group |

### Price Lists

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/pricing/lists` | List all price lists |
| `GET` | `/pricing/lists/:id` | Get a single price list |
| `POST` | `/pricing/lists` | Create a price list |
| `PUT` | `/pricing/lists/:id` | Update a price list |
| `DELETE` | `/pricing/lists/:id` | Delete a price list |

### Price Rules

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/pricing/lists/:id/rules` | Get rules for a price list |
| `GET` | `/pricing/rules/:id` | Get a single rule |
| `POST` | `/pricing/rules` | Create a rule |
| `PUT` | `/pricing/rules/:id` | Update a rule |
| `DELETE` | `/pricing/rules/:id` | Delete a rule |
| `POST` | `/pricing/rules/check-conflicts` | Check for rule conflicts |

### Price Calculation

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/pricing/calculate` | Calculate price for a single item |
| `POST` | `/pricing/calculate/bulk` | Calculate prices for multiple items |
| `GET` | `/pricing/customer/:kundenr/rules` | Get applicable rules for a customer |

## ETL / Database Management (admin only)

All ETL routes are rate-limited and accept up to 50 MB request bodies.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/etl/createDB` | Create / recreate database tables |
| `GET` | `/etl/truncateDB` | Truncate all table data |
| `GET` | `/etl/generateTestData` | Generate test data in memory |
| `GET` | `/etl/insertTestData` | Insert generated test data |
| `GET` | `/etl/runFullTestPipeline` | Full pipeline: truncate, create, generate, insert |
| `POST` | `/etl/generateBulkData` | Generate bulk data (configurable size) |
| `GET` | `/etl/insertBulkData` | Insert bulk data via optimised COPY |
| `POST` | `/etl/runBulkPipeline` | Full bulk pipeline |
| `GET` | `/etl/tableCounts` | Get row counts for all tables |
| `POST` | `/etl/upload-csv` | Upload CSV directly to a table (multipart) |

## Audit Log

| Method | Path | Middleware | Description |
|--------|------|-----------|-------------|
| `GET` | `/audit` | `authMiddleware` | Paginated audit log (filterable by entity_type, action) |
| `GET` | `/audit/:entityType/:entityId` | `authMiddleware` | History for a specific entity |

## Dashboard (admin only)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/dashboard/widgets` | All widget data in one call |
| `GET` | `/dashboard/analytics` | Batch analytics for dashboards |
| `GET` | `/dashboard/top-products` | Top products widget |
| `GET` | `/dashboard/top-customers` | Top customers widget |
| `GET` | `/dashboard/price-deviations` | Price deviation alerts |
| `GET` | `/dashboard/data-status` | Data freshness status |

## Other Resources

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/customers` | Admin | List all customers |
| `GET` | `/customers/:kundenr` | Admin | Single customer |
| `GET` | `/products` | Token | List all products |
| `GET` | `/products/groups` | Token | Product groups |
| `GET` | `/products/:varekode` | Token | Single product |
| `GET` | `/suggestions/search?q=` | Token (rate-limited) | Search suggestions |
| `GET` | `/reports` | Token | List saved reports |
| `POST` | `/reports` | Token | Save a report |
| `DELETE` | `/reports/:id` | Token | Delete a report |
| `GET` | `/health` | Public | Health check |

## Scheduler (admin only)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/scheduler/jobs` | List all scheduled jobs |
| `POST` | `/scheduler/jobs/:id/start` | Enable a job |
| `POST` | `/scheduler/jobs/:id/stop` | Disable a job |
| `POST` | `/scheduler/jobs/:id/run` | Run a job immediately |
| `GET` | `/scheduler/logs` | View job execution logs |

## Error Codes

| HTTP Status | Meaning |
|-------------|---------|
| `400` | Validation error (bad input) |
| `401` | Not authenticated |
| `403` | Not authorised (insufficient role) |
| `404` | Resource not found |
| `409` | Conflict (duplicate entry) |
| `429` | Rate limit exceeded |
| `500` | Internal server error |
