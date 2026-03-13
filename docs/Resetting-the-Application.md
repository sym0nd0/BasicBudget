# Resetting the Application

> **Warning:** Resetting the application permanently deletes all data. There is no undo. Take a backup first if you want to preserve anything. See [[Backup and Restore\|Backup-and-Restore]].

## Docker Reset

Stop the container and delete the database file:

```bash
docker compose stop
rm ./data/basicbudget.db
docker compose start
```

On next startup, BasicBudget creates a fresh database with the default schema. Navigate to the app URL and register a new first account (which will be granted Admin automatically).

## Docker Volume Reset

If you use a named volume:

```bash
docker compose down
docker volume rm basicbudget-data
docker compose up -d
```

## Manual Setup Reset

```bash
rm data/basicbudget.db
npm start
```

## Resetting a Single User

To remove a specific user without resetting the entire application:

1. Log in as an Admin.
2. Go to **Admin** → **User Management**.
3. Find the user and click **Delete User**.

This permanently removes the user and all their personal data (income, expenses, debts, savings goals). Household-shared data created by that user may remain visible to other household members.

## After Resetting

After a full reset:

1. Register a new account — the first account created becomes Admin.
2. Configure SMTP and OIDC in the [[Admin]] panel if needed.
3. Set up expense categories.
4. Invite household members.

---

<table width="100%">
<tr>
<td align="left">&#8592; <a href="Chart-Issues">Chart Issues</a></td>
<td align="right"><a href="Development-Setup">Development Setup</a> &#8594;</td>
</tr>
</table>
