# Hospital Management — machine setup

This repository has two applications:

- `Backend` — Express API with Prisma and PostgreSQL
- `Frontend` — React app served by Vite

The API listens on `http://127.0.0.1:5000`. The UI is at `http://127.0.0.1:5173` and proxies `/api` to the backend.

These steps were verified on Ubuntu with Node.js 26 and PostgreSQL 16.

## 1. Install the prerequisites

| Tool | Version used here | Notes |
| --- | --- | --- |
| Node.js | 20.19+ or 22.12+ (26 works) | npm is included |
| PostgreSQL | 16 | Server binaries are required, not only the client |
| Git | any current version | Only needed when cloning |

On Ubuntu:

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
```

Install Node.js LTS from [nodejs.org](https://nodejs.org/) if `node` is missing. Confirm both tools:

```bash
node --version
npm --version
psql --version
```

## 2. Install project dependencies

From the repository root:

```bash
cd Backend
npm install

cd ../Frontend
npm install
```

## 3. Create the PostgreSQL database

The system PostgreSQL service may already be running on port `5432` under a password you do not have. This project can use its own cluster on port `5433`, owned by your Linux user. That does not require `sudo` or the `postgres` superuser password.

```bash
PG=/usr/lib/postgresql/16/bin
BASE="$HOME/.local/share/hospital-management"
DATA="$BASE/pgdata"
RUN="$BASE/run"
mkdir -p "$BASE" "$RUN"
openssl rand -base64 24 | tr -d '\n' > "$BASE/db.pass"
chmod 600 "$BASE/db.pass"

"$PG/initdb" -D "$DATA" -U hms --pwfile="$BASE/db.pass" \
  --auth-local=peer --auth-host=scram-sha-256

"$PG/pg_ctl" -D "$DATA" -l "$BASE/postgres.log" \
  -o "-p 5433 -k $RUN -c listen_addresses=127.0.0.1" start

export PGPASSWORD="$(cat "$BASE/db.pass")"
"$PG/psql" -h 127.0.0.1 -p 5433 -U hms -d postgres \
  -c "CREATE DATABASE hospital_management;"
```

The database password is stored only in `~/.local/share/hospital-management/db.pass`. Do not commit it.

If you already have a PostgreSQL login, skip the private cluster and create `hospital_management` on the existing server instead. Use that host, port, user, and password in `DATABASE_URL` below.

Start the same cluster again after a reboot:

```bash
/usr/lib/postgresql/16/bin/pg_ctl \
  -D "$HOME/.local/share/hospital-management/pgdata" \
  -l "$HOME/.local/share/hospital-management/postgres.log" \
  -o "-p 5433 -k $HOME/.local/share/hospital-management/run -c listen_addresses=127.0.0.1" \
  start
```

Stop it with `pg_ctl -D "$HOME/.local/share/hospital-management/pgdata" stop`.

## 4. Configure environment files

Create `Backend/.env` from the password file. The command URL-encodes the password, which matters when it contains `+`, `/`, `=`, `@`, or `:`.

```bash
cd Backend
python3 - <<'PY'
import os, urllib.parse
pw = open(os.path.expanduser("~/.local/share/hospital-management/db.pass")).read().strip()
enc = urllib.parse.quote(pw, safe="")
jwt = os.popen("openssl rand -hex 32").read().strip()
open(".env", "w").write(
    "PORT=5000\n"
    f'DATABASE_URL="postgresql://hms:{enc}@127.0.0.1:5433/hospital_management?schema=public"\n'
    f'JWT_SECRET="{jwt}"\n'
)
os.chmod(".env", 0o600)
PY
```

Create `Frontend/.env` from the example:

```bash
cd ../Frontend
cp .env.example .env
```

`Frontend/.env` only sets the hospital name and address printed on bills and reports. The UI talks to the API through the Vite proxy, so no API URL is required.

Neither `.env` file should be committed.

## 5. Create tables and the admin user

From `Backend`:

```bash
npx prisma generate
npx prisma migrate deploy
npm run seed
```

`prisma generate` builds the Prisma client. `prisma migrate deploy` applies the checked-in migrations. The seed creates the POC administrator:

| Field | Value |
| --- | --- |
| Username | `admin` |
| Password | `admin123` |
| Employee ID | `EMP001` |

Change this password before any real use. For local schema changes, use `npx prisma migrate dev` instead of `migrate deploy`.

## 6. Run the applications

Use two terminals.

**Terminal 1 — API**

```bash
cd Backend
npm start
```

The process should print `server is running on 5000`.

**Terminal 2 — UI**

```bash
cd Frontend
npm run dev
```

Open `http://127.0.0.1:5173` and sign in with `admin` / `admin123`.

## 7. Check the login API

With the backend running:

```bash
curl -s -X POST http://127.0.0.1:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'
```

A successful response includes a JWT and the administrator user.

## Common problems

- **`P1001` or connection refused on 5433**: the private cluster is stopped. Start it with the `pg_ctl` command in section 3, then confirm `pg_isready -h 127.0.0.1 -p 5433`.
- **Password authentication failed**: `DATABASE_URL` must use user `hms`, port `5433`, and the password in `~/.local/share/hospital-management/db.pass`.
- **`Environment variable not found: DATABASE_URL`**: the file must be named `.env` and sit in `Backend`, next to `package.json`.
- **Login fails after a fresh database**: run `npm run seed` from `Backend`.
- **Port 5000 or 5173 is already in use**: stop the other process, or change `PORT` in `Backend/.env` and the proxy target in `Frontend/vite.config.js` together.
- **Prisma client errors after dependency changes**: from `Backend`, run `npm install` and `npx prisma generate` again.

## Useful commands

```bash
# Backend
cd Backend
npm start
npm run seed
npx prisma studio

# Frontend
cd ../Frontend
npm run dev
npm run build
npm run lint
```

## Windows

On Windows, install Node.js LTS, PostgreSQL from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/), and Git. pgAdmin is included with the PostgreSQL installer.

1. In pgAdmin, create a database named `hospital_management` owned by `postgres`.
2. Put the same `Backend/.env` keys in `Backend\.env`, using port `5432` and the password chosen during PostgreSQL setup:

```env
PORT=5000
DATABASE_URL="postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/hospital_management?schema=public"
JWT_SECRET="replace-this-with-a-long-random-secret"
```

3. From `Backend`, run `npm install`, `npx prisma generate`, `npx prisma migrate deploy`, and `npm run seed`.
4. From `Frontend`, run `npm install`, copy `.env.example` to `.env`, then `npm run dev`.
5. Start the API with `npm start` in a second PowerShell window.
6. Open the Vite URL, normally `http://localhost:5173`.
