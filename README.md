# Finance Tracker 2.0

## Added

- Email/password authentication with bcrypt and an HTTP-only JWT cookie
- PostgreSQL persistence with automatic startup migrations
- Per-user categories, transactions, and recurring rules
- CSV export at `GET /api/transactions.csv`
- Weekly, monthly, and yearly recurring transactions, materialized when a user logs in or loads transactions
- Category doughnut chart and 12-month income/expense trend chart

## Run

1. Create a PostgreSQL database.
2. Set `DATABASE_URL` and a strong `JWT_SECRET`.
3. Run `npm install` and `npm start`.

Example:

```bash
DATABASE_URL=postgres://user:password@localhost:5432/finance JWT_SECRET=replace-me npm start
```

`DATABASE_SSL=false` disables SSL for local PostgreSQL. The app creates its tables automatically. Existing JSON data is not automatically migrated; export it before upgrading if needed.
