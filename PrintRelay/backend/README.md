# PrintRelay API

Base URL: `/api`. JSON in/out. Auth via HttpOnly cookie `pr_token` (set by login/register).
All non-GET requests must send `X-Requested-With: PrintRelay`.
Success: `{ "data": ..., "pagination": { page, limit, total, totalPages }? }` — Error: `{ "error": { "message", "details"?, "code"? } }`.
Money is **integer paise**.

## Auth
| Method & path | Role | Notes |
|---|---|---|
| `POST /auth/register/customer` | public | `{name,email,password,phone?}` |
| `POST /auth/register/shop-owner` | public | `{name,email,password,phone,shop:{name,address:{line,locality,city,state?,pincode?},phone,email?,hours?}}` — shop starts `PENDING` |
| `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` | | |
| `PATCH /auth/profile` · `PATCH /auth/password` | any | |

Local demo accounts and the approved `PrintRelay Demo Shop` are created with
`npm run seed:demo`. This command is limited to `NODE_ENV=development` and
requires `DEMO_SEED_ENABLED=true`; it updates only the dedicated demo accounts
and their shop. Keep their credentials in the ignored `backend/.env` file.

## Local development
Configure `backend/.env` from `.env.example`, preserving your existing Atlas URI
and application secrets. Set the local demo credentials and enable demo seeding.
Then run:

```powershell
cd backend
npm run seed:demo
npm run dev
```

In another terminal:

```powershell
cd frontend
npm run dev
```

Open the frontend URL printed by Vite (normally `http://localhost:5173`; it may
use `http://localhost:5174` if 5173 is occupied). Both local development ports
are allowed by the backend CORS configuration. The API listens on
`http://localhost:5000`.

## Shops (public discovery — approved shops only)
- `GET /shops?q=&service=bw,colour,spiral&accepting=true&page=&limit=` — includes real `activeQueue` count
- `GET /shops/:id`

## Shop owner (`/shop/*`, role `shop_owner`, always scoped to the caller's own shop)
- `GET|PATCH /shop/me` — profile, address, phone, hours
- `PATCH /shop/me/offerings` — `{services:{bw,colour,spiralBinding}, pricing:{bwPerSidePaise,colourPerSidePaise,spiralBindingPaise}}`
- `PATCH /shop/me/availability` — `{isOpen?, acceptingOrders?}` (accepting requires approval + configured prices)
- `GET /shop/orders?section=requests|queue|ready|history&page=&q=` · `GET /shop/orders/summary` · `GET /shop/orders/:id`
- `PATCH /shop/orders/:id/accept` | `/reject {reason}` | `/start` | `/ready` | `/cancel {reason}` (ACCEPTED only) | `/payment {upiReference?}`
- `POST /shop/orders/verify-pickup` — `{token}` (QR) or `{orderNumber, code}`; `collect:false` for preview only

## Customer (`/files`, `/orders`, role `customer`)
1. `POST /files` (multipart field `file`, PDF ≤ 10 MB) → `{id, filename, size, pageCount}`; validated by signature + parse, stored privately in GridFS.
2. `POST /orders/quote` → server-side price for the live estimate.
3. `POST /orders` → `{shopId,fileId,printType:BW|COLOUR,copies:1-20,pageSelection:{mode:ALL}|{mode:RANGE,ranges:"1-5, 8"},sides:SINGLE|DOUBLE,paperSize:A4,binding:NONE|SPIRAL,paymentPreference:CASH|UPI}`
- `GET /orders?status=&active=true&q=&page=` · `GET /orders/:id` (includes `queue:{position,ahead,isPrinting}` and `events`)
- `GET /orders/:id/pickup` — QR data URL + 6-digit code, only while `READY_FOR_PICKUP`
- `PATCH /orders/:id/cancel` — PENDING only
- `GET /files/:fileId[?download=1]` — authenticated stream (uploader, or the shop that received an order with that file)

## Notifications (any signed-in user)
`GET /notifications?unread=true` · `GET /notifications/unread-count` · `PATCH /notifications/:id/read` · `PATCH /notifications/read-all`
Live: Socket.IO events `notification` and `order:updated`.

## Admin (`/admin/*`, role `admin`)
`GET /admin/dashboard` · `GET /admin/shops?status=&q=` · `PATCH /admin/shops/:id/status {status:APPROVED|REJECTED|SUSPENDED, note}` · `GET /admin/users?role=&q=` · `PATCH /admin/users/:id/status` · `GET /admin/orders?status=&shop=&q=`
(Admins cannot read customer PDFs.)

## Status flow
`PENDING → ACCEPTED → PRINTING → READY_FOR_PICKUP → COLLECTED`; `PENDING → REJECTED | CANCELLED`; `ACCEPTED → CANCELLED`.
Payment (`UNPAID/PAID`) is separate; `COLLECTED` requires `PAID`.

## Tests
- `npm test` — unit tests (page ranges, pricing, pickup tokens, transitions, PDF validation) + HTTP smoke tests (no DB needed).
- `npm run test:integration` — full workflow against `mongodb-memory-server` (covers registration → approval → upload → order → FIFO queue → payment → single-use pickup → cross-tenant isolation).
