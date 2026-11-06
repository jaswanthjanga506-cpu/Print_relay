# Render and Vercel deployment

## Render API

Create a Render Blueprint from the repository root and select `PrintRelay/render.yaml`.
It builds `PrintRelay/backend`, starts `npm start`, and uses `/api/ready` as its
health check. The free Render plan may spin down when idle.

Set these Render environment values before the service starts:

- `MONGODB_URI`: the Atlas URI for the existing `printrelay_db1` database.
- `JWT_SECRET` and `PICKUP_SECRET`: different, randomly generated secrets.
- `CLIENT_ORIGINS`: the exact Vercel production origin, with no trailing slash
  (for example `https://your-project.vercel.app`). Add a custom frontend origin
  as another comma-separated exact origin if needed.
- `ADMIN_PASSWORD`, `DEMO_CUSTOMER_PASSWORD`, and
  `DEMO_SHOP_OWNER_PASSWORD`: three different, randomly generated secrets.

Generate secret values locally with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste each generated value directly into the matching Render environment
variable. Never put passwords in `render.yaml`, Vercel environment variables,
frontend source, or a public demo-login panel. Do not reuse the development
passwords that have appeared in chat or screenshots. Allow only Render's
outbound IP addresses in Atlas Network Access; do not allow `0.0.0.0/0`.

### Provision the production demo accounts once

The production demo seeder is never run during startup or deployment. After
Render is healthy and its secrets are set, open the service Shell and run:

```sh
DEMO_PRODUCTION_SEED_ENABLED=true npm run seed:demo:production
```

The script requires `NODE_ENV=production` and the explicit one-command opt-in.
It creates the dedicated admin, customer, and shop-owner accounts and an
approved **closed** demo shop. It never resets an existing account's password,
reactivates a suspended account, or changes an existing shop's settings.
Rerunning it is safe. The demo shop starts closed and does not accept public
orders. The account passwords remain private Render secrets; they are not
displayed by the app or written to logs.

Production passwords must be at least 32 characters and different for each
account (maximum 72 UTF-8 bytes for bcrypt). The seeder prints only account
email addresses and whether each account was created or already existed.

## Vercel frontend

Create a Vercel project with **Root Directory** `PrintRelay/frontend`. Use the
existing `vercel.json` SPA rewrite. Add this Production environment variable
in Vercel and redeploy:

```text
VITE_API_URL=https://<your-render-service>.onrender.com
```

The production build fails when `VITE_API_URL` is missing or is not HTTPS,
instead of deploying a site that calls `localhost`.

After Vercel assigns the production domain, copy its exact origin into Render's
`CLIENT_ORIGINS`. The API uses secure cookies. For reliable browser sessions
with third-party-cookie restrictions, use custom frontend and API hostnames
under the same site (for example `app.example.com` and `api.example.com`),
then set `VITE_API_URL` and `CLIENT_ORIGINS` to those exact HTTPS origins.

## Deployment verification

1. Render's `/api/ready` returns HTTP 200 after Atlas connects.
2. The Vercel production build completes with `VITE_API_URL` configured.
3. From the deployed frontend, sign in with each privately provisioned account.
4. Confirm the demo shop remains closed before enabling any real production shop.
5. Do not commit `.env` files or production credentials.
