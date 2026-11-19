# Hospital Management load tests

Grafana k6 exercises the API on this machine. The scripts do not start a test, create a database, or drop one when they are imported. `reports/smoke.js` is only the earlier k6 installation check against `test.k6.io`. The hospital suite is `scenarios/`.

No Backend or Frontend file is part of this harness. Patients, visits, bills, and passwords are synthetic. The POC database `hospital_management` and API port `5000` are refused.

## Safety rules

`lib/config.js` allows only `http://127.0.0.1` or `http://localhost`, and only the database name `hospital_management_loadtest`. Port `5000` is rejected. `data/seed.js` checks the connected database name and server address again before creating the database, before migrations, and before every bulk insert. It never drops a database. `data/verify.sql` and `observe/collect.sh` make the same name check.

Five wrong passwords lock an account. The scenarios use the generated password, so do not point them at a login with a different password.

## Files

| File | Role |
| --- | --- |
| `lib/config.js` | Loopback and database-name guards |
| `lib/auth.js` | Role lookup, login, refresh |
| `lib/flows.js` | Reception, billing, and admin desk iterations |
| `data/seed.js` | Create the test database, migrate, and insert synthetic rows |
| `data/verify.sql` | Read-only invariant checks |
| `observe/collect.sh` | Sample CPU, RSS, connections, lock waits, and slow queries |
| `scenarios/smoke.js` | One pass through reception, billing, and admin |
| `scenarios/normal.js` | 14 desks for 10 minutes, 8–20 s think time |
| `scenarios/peak.js` | 15 desks for 10 minutes, 2–5 s think time |
| `scenarios/stress.js` | Ramp to 60 virtual users and abort past the failure line |
| `scenarios/bulk.js` | 10 desks against the optional large history |
| `scenarios/soak.js` | 14 desks for 2 hours, refreshing the access token |
| `scenarios/race.js` | 30 parallel visit creates and 30 parallel identical bills |

Thresholds in the normal and peak scripts are gates, not measurements.

## Prepare the smoke test

Use the local PostgreSQL user that can create a database. URL-encode the password. Do not use the POC URL.

```bash
cd /home/anandu/PROJECTS/Hospital-Management/load-testing

export TEST_DATABASE_URL='postgresql://hms:URL_ENCODED_PASSWORD@127.0.0.1:5433/hospital_management_loadtest?schema=public'
export BASE_URL='http://127.0.0.1:5001'
```

The password for the user-owned cluster is in `~/.local/share/hospital-management/db.pass`. Encode it before placing it in the URL:

```bash
python3 - <<'PY'
import urllib.parse
print(urllib.parse.quote(open("/home/anandu/.local/share/hospital-management/db.pass").read().strip(), safe=""))
PY
```

Create the test database and synthetic data. This does not drop anything.

```bash
node data/seed.js
```

The command writes `data/users.json` with mode `600`. That file holds the generated password and is gitignored. Keep it. Deleting it makes the next seed generate a password the existing rows will not use.

In a second terminal, start an API process that cannot fall through to the POC database. `dotenv` keeps variables that are already set.

```bash
cd /home/anandu/PROJECTS/Hospital-Management/Backend
export TEST_DATABASE_URL='postgresql://hms:URL_ENCODED_PASSWORD@127.0.0.1:5433/hospital_management_loadtest?schema=public'
export DATABASE_URL="$TEST_DATABASE_URL"
export PORT=5001
node server.js
```

Confirm the process is on the test database:

```bash
psql "$TEST_DATABASE_URL" -c "SELECT current_database();"
```

The result must be `hospital_management_loadtest`. Leave the API on port 5000 unchanged.

## Execute the smoke test

From `load-testing`, with `BASE_URL` still set:

```bash
k6 run scenarios/smoke.js
```

Optional samples while it runs, in another terminal from `load-testing`:

```bash
OBSERVE_SECONDS=30 ./observe/collect.sh
```

After smoke, run the read-only checks:

```bash
psql "$TEST_DATABASE_URL" -f data/verify.sql
```

`verify.sql` raises an exception on a broken invariant. A same-day visit race is reported there. `scenarios/race.js` is separate and is not part of smoke.

## Later scenarios

Run these only after smoke and verification pass.

```bash
k6 run scenarios/normal.js
k6 run scenarios/peak.js
k6 run scenarios/stress.js
k6 run scenarios/soak.js
k6 run scenarios/race.js
```

Bulk history is off unless you set both variables and run the seed again. The second run does not drop the database. If bulk rows already exist, the seed stops instead of deleting them.

```bash
SEED_BULK=1 SEED_BULK_CONFIRM=hospital_management_loadtest node data/seed.js
k6 run scenarios/bulk.js
```

Bulk volumes are 50,000 patients, 200,000 visits, and 100,000 bills. Those counts are a test design choice, not a hospital census.

## What smoke covers

One reception user registers a new `LOADTEST` patient, searches, opens the chart, creates an OP visit, reprints the token, and reads history plus the daily receptionist report. One billing user searches, quotes, creates a cash bill, and reads the receipt. One admin user reads users, departments, schemes, the catalog, and the daily reports. A repeated same-day visit is HTTP 409 and is not counted as a transport failure. Payment is stored by bill creation. There is no separate payment endpoint.
