# API

BasicBudget exposes a REST API used by its own frontend. You can use this API to build integrations, scripts, or automation. All endpoints require an active session cookie obtained by logging in.

## Base URL

```
http://localhost:3000/api
```

Replace `localhost:3000` with your instance's URL.

## Authentication

All API requests require an active session. Log in via `POST /api/auth/login` to obtain a session cookie, then include it in subsequent requests.

```bash
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"yourpassword"}'
```

## Income Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/incomes?yearMonth=YYYY-MM` | List income entries active for the given month |
| `POST` | `/api/incomes` | Create a new income entry |
| `PUT` | `/api/incomes/:id` | Update an existing income entry |
| `DELETE` | `/api/incomes/:id` | Delete an income entry |

## Expense Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/expenses?yearMonth=YYYY-MM` | List expense entries active for the given month |
| `POST` | `/api/expenses` | Create a new expense entry |
| `PUT` | `/api/expenses/:id` | Update an existing expense entry |
| `DELETE` | `/api/expenses/:id` | Delete an expense entry |

## Debt Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/debts` | List all debt entries |
| `POST` | `/api/debts` | Create a new debt entry |
| `PUT` | `/api/debts/:id` | Update an existing debt entry |
| `DELETE` | `/api/debts/:id` | Delete a debt entry |
| `GET` | `/api/debts/:id/repayments` | Get the repayment schedule for a debt |

## Savings Goals Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/savings-goals` | List all savings goals |
| `POST` | `/api/savings-goals` | Create a new savings goal |
| `PUT` | `/api/savings-goals/:id` | Update an existing savings goal |
| `DELETE` | `/api/savings-goals/:id` | Delete a savings goal |

## Reports Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/reports/overview?from=YYYY-MM&to=YYYY-MM` | Overview summary for a date range |
| `GET` | `/api/reports/debt-projection?household_only=true` | Debt projection data |

## Other Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/summary?yearMonth=YYYY-MM` | Dashboard summary for a month |
| `GET` | `/api/accounts` | List payment accounts |
| `GET` | `/api/categories` | List expense categories |
| `GET` | `/api/months` | List available months with data |
| `GET` | `/api/version` | Current application version |
| `POST` | `/api/export` | Download a JSON export of all data |

## Request and Response Format

- Request bodies use `Content-Type: application/json`.
- Monetary values in request bodies are in **pence** (integers).
- Monetary values in responses are in **pence** (integers).
- Date fields use `YYYY-MM` format for month references.

---

<table width="100%">
<tr>
<td align="left">&#8592; <a href="Data-Import">Data Import</a></td>
<td align="right"><a href="Customisation">Customisation</a> &#8594;</td>
</tr>
</table>
