# Deploying to production (free tier)

Everything below is done once, by the owner, in their own accounts. The code and configuration are ready;
nothing here can be done on your behalf because it needs accounts and secrets that only you should hold.

## 1. Database: Supabase (free)

1. Create a project at supabase.com. Choose a region close to Saudi Arabia (for example Frankfurt or Mumbai).
2. Open **Project Settings → Database → Connection string → Transaction pooler** and copy the URI.
   Replace `[YOUR-PASSWORD]` with the database password. This is your `DATABASE_URL`.
3. Create the tables from your own computer (once, and again after any new migration):

```bash
DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres" npm run migrate
```

The migrations enable row-level security on every table with no policies, so the public Supabase API keys can
never read the data. The app talks to the database directly with `DATABASE_URL`, which stays on the server.

## 2. Email: Resend (free)

1. Create an account at resend.com and an API key (`RESEND_API_KEY`).
2. To email an address you own, you can start with the default sender `onboarding@resend.dev`. For your own
   domain, add and verify it in Resend, then set `EMAIL_FROM`.

## 3. Hosting: Vercel (free)

1. Push this repository to GitHub and import it in vercel.com.
2. Add these environment variables (Production):

| Variable | Value |
|---|---|
| `DATABASE_URL` | the pooler URI from step 1 |
| `SESSION_SECRET` | output of `openssl rand -hex 32` |
| `CRON_SECRET` | output of `openssl rand -hex 24` |
| `APP_URL` | your site address, for example `https://family-tracker.vercel.app` |
| `RESEND_API_KEY` | from step 2 |
| `EMAIL_FROM` | optional, for your own domain |
| `OWNER_EMAIL`, `OWNER_PASSWORD` | the owner login (min 10 characters). Used once, see below |

3. Deploy. `vercel.json` already schedules the weekly backup (Sundays 03:00 UTC) and the daily reminders
   check (06:00 UTC). Vercel sends `CRON_SECRET` as a bearer token automatically.

## 4. First run

1. Open the site and sign in with `OWNER_EMAIL` / `OWNER_PASSWORD`. The owner row is created from those
   variables the first time the app starts with an empty database.
2. **Remove `OWNER_PASSWORD` from Vercel** afterwards and redeploy. It is not needed again; to change the
   password later run `npm run create-owner` against the production `DATABASE_URL`.
3. Complete the setup wizard (salary, opening savings balance, reminder email).
4. More → Dad's access: choose a PIN, copy the link, send the link and tell the PIN separately.

## 5. Verify the deployment

```bash
# unauthenticated pages must redirect to /login and data endpoints must refuse
curl -sI https://YOUR-SITE/month | head -3
curl -s -o /dev/null -w "%{http_code}\n" https://YOUR-SITE/api/export          # 307 or 401
curl -s -o /dev/null -w "%{http_code}\n" https://YOUR-SITE/api/cron/backup     # 401

# the cron endpoints work with the secret
curl -s -H "Authorization: Bearer $CRON_SECRET" https://YOUR-SITE/api/cron/backup
```

The backup call returns `{"emailed":true}` and an email with two attachments arrives at the reminder address.
Then run the e2e suite locally (`npm run e2e`) and the bundle check after `npm run build` (`npm run check:bundle`).

## 6. Day-to-day

- Backups arrive by email every week. Keep the JSON files somewhere safe.
- To restore, see "Backup and restore" in the README.
- Free tiers: Supabase pauses projects that are inactive for a week. Opening the site weekly (the cron does)
  keeps it awake. Check the Supabase dashboard if the site ever shows an error.
