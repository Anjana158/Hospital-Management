# Hospital Management System — Static Scalability Audit

Inspection date: 12 November 2026  
Method: source-code and Prisma schema inspection only  

This report does not contain measured response times, throughput, or memory figures. No test data was created. No database connection was opened. No `EXPLAIN`, load test, stress test, or concurrent request was executed. Where runtime behaviour cannot be proven from code, the finding is marked **Potential risk** or **Requires runtime validation**.

---

## 1. Executive summary

The application is a single Node.js/Express API in front of PostgreSQL through one Prisma client, with a React client split into Admin, Reception, and Billing. That shape is appropriate for one hospital server and about 25–30 desks, provided the server is dedicated, backed up, and the queries that grow with history are bounded.

The design is already stronger than a typical first version in several places:

- OP token numbers are allocated with `INSERT ... ON CONFLICT` and protected by a unique key on department, date, and token number.
- Patient search, today’s patients, and today’s OP list are paginated.
- Bills and bill payments use idempotency keys and serializable transactions.
- Visit and bill rows store scheme and price snapshots.
- Most write APIs validate input on the server with Zod. Frontend checks are not the only checks.

The issues that should be treated before hospital deployment are:

1. Two receptionists can register the same patient in the same department on the same day. The token counter will still issue two different numbers. There is no unique rule for “one active visit per patient, department, and day.”
2. Patient search uses leading-wildcard, case-insensitive `contains` filters. Pagination limits the response, not the scan. This is the query most likely to slow down as the patient table grows.
3. Reception and admin activity reports, and billing reports, load every matching visit or bill into Node.js and return full detail lists. Billing reports cap a custom range at 366 days. Reception and admin reports do not.
4. OP fee and billing category (`APL` or `BPL`) are accepted from the client. Scheme math itself is calculated on the server.
5. Phone duplicate detection is a check-then-insert with no unique constraint, and it is skipped when no phone is supplied.
6. There is no backup, restore, pool, timeout, or PostgreSQL configuration in the repository. A separate 1 TB disk is a capacity idea only until a backup procedure exists.
7. The React client calls a fixed address, `http://100.103.223.11:5000`, while login refresh uses a relative `/api` path. LAN and VPN clients will not behave the same unless every desk can reach that address and the page is served in a way that proxies `/api`.

No finding below is a measured failure. Each one is a code path that can fail, or a query shape that becomes more expensive as rows accumulate.

---

## 2. Existing project architecture

### Request path

```text
Desk browser (LAN or VPN)
    -> React (Vite dev server on 0.0.0.0:5173, or a future static host)
        -> most data calls: http://100.103.223.11:5000/api/...
        -> login refresh and logout: relative /api (Vite proxy to 127.0.0.1:5000)
    -> Express (server.js listens on 0.0.0.0, port 5000 or PORT)
        -> authenticateToken (Bearer JWT)
        -> requireRole
        -> controller
        -> service (Zod, then Prisma)
    -> one shared PrismaClient
    -> PostgreSQL (DATABASE_URL; server settings are not in this repo)
```

There is one Node process. There is no cluster module, reverse proxy, or PgBouncer in the repository. Prisma is constructed once in `Backend/src/config/prisma.js` as `new PrismaClient()` with no pool options. Pool size, statement timeout, and SSL mode are whatever the `DATABASE_URL` and PostgreSQL defaults supply. Those values were not read from a live environment.

### Frontend

React routes in `Frontend/src/App.jsx`:

| Area | Base path | Role gate in the UI | Main screens |
|---|---|---|---|
| Login | `/` | public | username, password, selected role |
| Admin | `/dashboard` | `ADMIN` | home, users, schemes, departments, billing service catalog, reception reports, billing reports, receipt |
| Reception | `/reception` | `RECEPTION` | home, patients, OP registration, OP ticket, receptionist report |
| Billing | `/billing` | `BILLING` or `ADMIN` | home, new bill, receipt, billing report |

Access tokens are stored in `localStorage`. Refresh tokens are stored in an `httpOnly` cookie named `refreshToken`, path `/api/auth`.

### Backend modules and routes

| Prefix | Auth | Purpose |
|---|---|---|
| `/api/auth` | mixed | roles lookup (public), login, refresh, logout, `/me` |
| `/api/users` | `ADMIN` | users and roles |
| `/api/dashboard` | `RECEPTION`, `BILLING` | logged-in profile only |
| `/api/patients` | `RECEPTION` | register, search, today, details, update |
| `/api/schemes` | read: `RECEPTION` or `ADMIN`; write: `ADMIN` | scheme master |
| `/api/departments` | read: `ADMIN` or `RECEPTION`; write: `ADMIN` | departments |
| `/api/visits` | `RECEPTION` | OP register, history, today, reprint by id |
| `/api/reports` | receptionist or admin route | OP activity reports |
| `/api/billing` | `BILLING` and `ADMIN`, with extra admin-only writes | catalog, bills, payments, billing reports, billing-side patient register |

`BILLING` cannot call `/api/patients` or `/api/visits`. Billing patient registration goes through `/api/billing/patients`, which calls the same `registerPatientRecord` function. `ADMIN` cannot call `/api/dashboard/me`. The admin home page reads the user from `localStorage` and does not call that endpoint. The billing home page does call it, so an admin who opens `/billing` is outside that route’s role list.

### Authentication and authorization

- Access JWT lifetime is 15 minutes. Payload is `userId`, `username`, `role`, and `type: "access"`.
- Refresh tokens are 48 random bytes, stored as SHA-256 hashes, rotated on use, and expire after 7 days.
- Reuse of an already revoked refresh token revokes the user’s other live refresh tokens.
- Failed logins increment `failedAttempts` and lock the account at 5.
- `requireRole` checks the role embedded in the JWT, not a fresh database read, until the access token expires.

### Transactions

| Operation | Boundary |
|---|---|
| OP registration | one interactive Prisma transaction; token row updated with raw SQL |
| Patient create / update | separate statements, no wrapping transaction |
| Bill create | serializable transaction after price calculation; up to 3 attempts on unique or serialization conflicts |
| Add payment / reverse payment | serializable transaction, no retry loop |
| Login lock counter | read, then a later update |

### Validation, errors, logging

- Zod schemas guard patient, visit, scheme, and billing payloads.
- Each controller has its own `try/catch`. There is no global error middleware.
- Several 500 responses return `error.message`, which can include Prisma text.
- Logging is `console.log` / `console.error`. `morgan` and `helmet` are dependencies and are not mounted in `server.js`.
- Billing writes `BillingAudit`. Patient and visit changes do not.

### File storage and reporting

- No patient-document or image store exists.
- ExcelJS is used by `Backend/scripts/import-billing-catalog.js` and a unit test. It is not an API endpoint.
- Reports are JSON built in Node. There is no streaming or file export on the report endpoints.

### PostgreSQL configuration in source

Not present. The repo has `schema.prisma`, SQL migrations, and `DATABASE_URL` in `Backend/.env.example` as a placeholder. Live parameter values (`shared_buffers`, `work_mem`, `max_connections`, `statement_timeout`, pool limit) were not inspected.

### Data relationships

```text
Role *---* User, through UserRole
User 1---* RefreshToken
User 1---* Patient (createdBy)
User 1---* PatientVisit (createdBy)
PatientScheme 1---* Patient
PatientScheme 1---* Bill
PatientScheme 1---* BillingSchemeBenefit *---1 BillingService
Department 1---* PatientVisit
Department 1---* DailyTokenCounter
Patient 1---* PatientVisit
Patient 1---* Bill 1---* BillItem
Bill 1---* BillPayment
BillingService 1---* ServiceTariff
User 1---* BillingAudit
```

Deletes are mostly `Restrict` on clinical and money rows. Refresh tokens and user-role links cascade with the user. Scheme benefits cascade with the scheme.

---

## 3. Database structure assessment

Table names below match Prisma model names. Models without `@@map` use those names in PostgreSQL. `Role`, `User`, `UserRole`, and `RefreshToken` are mapped to `roles`, `users`, `user_roles`, and `refresh_tokens`.

### Patient

| Item | Evidence |
|---|---|
| Primary key | `id` serial |
| Unique | `uhid` |
| Foreign keys | `schemeId` → PatientScheme, `createdBy` → User |
| Indexes | `(lastName, firstName)`, `(phone)`, `(schemeId)`, `(createdAt)` |
| Search fields in code | `uhid`, `firstName`, `middleName`, `lastName`, `phone`, `alternatePhone`, plus `gender` and `age` |
| Frequent filters | today’s `createdAt` range; phone equality for duplicates; `contains` search |
| Scalability note | `createdAt` supports today’s list. Name and phone indexes do not serve `contains` / case-insensitive search. `alternatePhone`, `updatedAt`, `gender`, and `age` are unindexed. `phone` is not unique. |

### PatientVisit

| Item | Evidence |
|---|---|
| Primary key | `id` serial |
| Unique | `visitNumber`; `(departmentId, tokenDate, tokenNumber)` |
| Foreign keys | `patientId`, `departmentId`, `createdBy` |
| Indexes | `(visitDate)`, `(patientId, visitDate)`, `(patientId, departmentId, visitDate)`, `(departmentId, visitDate)`, `(createdBy, visitDate)`, `(visitDate, tokenNumber)`, `(patientId, departmentId, revisitCount)` |
| Frequent filters | date range, department, creator, status not cancelled, patient history |
| Missing for current queries | no unique key on one active visit per patient, department, and calendar day; no index leading with `paymentStatus` / `paymentMethod` |
| Redundant index | `(visitDate)` is a prefix of `(visitDate, tokenNumber)`. `(departmentId)` on the token counter is a prefix of the unique `(departmentId, tokenDate)`. These are extra writes, not a functional defect. |

### DailyTokenCounter

| Item | Evidence |
|---|---|
| Primary key | `id` |
| Unique | `(departmentId, tokenDate)` |
| Columns | `nextToken` integer, default 1 |
| Use | one row per department per hospital day |

### PatientScheme

Small master table: unique `code` and `name`, eligibility columns, discount type and value. Volume stays tiny relative to patients. `Bill` and `PatientVisit` copy scheme facts onto the transaction row.

### User and RefreshToken

Unique `username` and `employeeId`. Refresh token hash is unique. Index on `userId`. User count for 30 desks is small. Refresh rows grow with every login and rotation; nothing in code deletes expired rows.

### Billing tables

`Bill.billNumber` and `Bill.idempotencyKey` are unique. Payment idempotency keys are unique. Indexes exist for bill date, creator, patient, scheme, payment confirmation time, handler, and reversal time. Current-tariff uniqueness is a partial unique index: one open tariff per service and category (`endedAt IS NULL`). These tables are in better shape for reporting filters than the patient search path. Report queries still return every bill in the range.

### Denormalized fields that are intentional

Visit rows copy OP fee, discount, scheme identity, and eligibility JSON. Bill items copy service name and tariff. That protects old receipts when master data changes. Admin reception reports still count schemes from the patient’s current scheme, not from `schemeNameAtVisit`.

---

## 4. Database scalability analysis

Indexes that match the hot paths:

- Today’s patients: `Patient.createdAt`.
- Today’s visits and date-bounded visit reports: `PatientVisit.visitDate` and the composites that start with `visitDate`, `departmentId`, or `createdBy`.
- One patient’s visits: `(patientId, visitDate)`.
- Bills by day or cashier: `Bill.createdAt`, `(createdBy, createdAt)`.
- Token allocation: unique `(departmentId, tokenDate)`.

Indexes that do not match the search the UI actually runs:

- `contains` with `mode: "insensitive"` becomes a case-insensitive pattern with wildcards on both sides. A normal B-tree on `phone` or `(lastName, firstName)` is not used for that pattern.
- There is no `pg_trgm` index in any migration.
- Search also sorts by `updatedAt`, which has no index.

Query-shape risks, from code:

- `searchPatients` runs `findMany` and `count` for the same `OR` of `contains` predicates.
- `getPatientVisitHistory` returns every visit for a patient, including the patient row again on each visit, with no `take`.
- `getPatientDepartmentVisitHistory` and `registerVisitRecord` load every previous visit in that department to compute `previousVisits.length`.
- Admin, receptionist, and billing reports use unbounded `findMany` inside the chosen dates, then aggregate again in JavaScript. Admin and billing reports also run SQL `aggregate` / `groupBy`, so some totals are computed twice.

No measured row counts or timings are available.

---

## 5. API performance analysis

Limits below are what the code enforces. “Rows touched” is the code path, not a measurement.

| Endpoint | Queries and shape | Pagination | Where filtering happens | Growth risk |
|---|---|---|---|---|
| `POST /api/patients` | scheme lookup, up to 10 phone matches, insert, up to 3 UHID retries | n/a | PostgreSQL equality on phone | Low per request. Duplicate check is not atomic. |
| `GET /api/patients/search` | `findMany` take ≤ 50 plus `count` | page, limit ≤ 50 | PostgreSQL, but `ILIKE '%term%'` across several columns | High as patient count grows. Response size stays small. |
| `GET /api/patients/today` | `findMany` take ≤ 50 plus `count` on `createdAt` | page, limit ≤ 50 | PostgreSQL | Low. One day stays small. |
| `GET /api/patients/:id` and `/uhid/:uhid` | one patient by primary key or unique UHID | n/a | PostgreSQL | Low. UHID lookup is case-insensitive `findFirst`, so it may not use the unique index as an equality probe. |
| `PATCH /api/patients/:id` | read patient, phone duplicate scan, scheme read, update | n/a | PostgreSQL | Low volume. Last write wins. |
| `POST /api/visits` | patient, department, same-day probe, all prior visits in department, token SQL, insert, update visit number | n/a | PostgreSQL inside one transaction | Token update is one row. History read grows with that patient’s visits in one department. |
| `GET /api/visits/today` | page of visits with patient, scheme, and department, plus count | page, limit ≤ 50 | PostgreSQL on `visitDate` | Low for a single day. |
| `GET /api/visits/:id` | one visit with patient and department | n/a | primary key | Low. |
| `GET /api/visits/patient/:id/history` | all visits with patient and department | none | PostgreSQL by `patientId` | Medium only for a patient with a very long visit list. Response repeats the patient on every row. |
| `GET .../department/:id/history` | all prior visits plus today’s visits, full rows, only to count them | none | PostgreSQL | Same patient-history growth, on the OP registration screen. |
| `POST /api/billing/bills/quote` and `POST /api/billing/bills` | patient, services, benefits, then one write transaction | items ≤ 100 | PostgreSQL for lookups; money math in Node | Low at hospital catalog size. |
| `POST /api/billing/bills/:billNumber/payments` | payment by idempotency key, bill with payments, insert, status update | n/a | inside serializable transaction | Low per bill. |
| `GET /api/billing/patients` | `findMany` take 20, same `contains` pattern | fixed 20, no page | PostgreSQL | Same search-scan risk as reception search. |
| `GET /api/billing/reports` | all bills in range with items and payments, all payments in range | none; custom range ≤ 366 days | date filter in PostgreSQL; totals in Node | High for a long range. |
| `GET /api/reports/receptionist` | all of that user’s visits in range, plus aggregates | none; no maximum range | date filter in PostgreSQL; gender and age counts in Node | High for custom ranges. |
| `GET /api/reports/admin` | all visits in range with patient identity, plus groupBy and aggregates | none; no maximum range | same split | Highest report risk. |
| `GET /api/dashboard/me` | one user | n/a | primary key | Low. No hospital statistics are computed here. |
| `POST /api/auth/login` | user by username, bcrypt, refresh insert, user update | n/a | unique username | Low. bcrypt cost is per login, not per patient. |

`GET /api/auth/roles?username=` is public and returns assigned role names for any username that exists.

---

## 6. Large dataset risk analysis

These rows are engineering judgements from query shape. They are not benchmarks. A hospital that adds a few hundred visits a day reaches 100,000 visits in roughly a year and 500,000 only after several years, or sooner if historical data is imported. Patient counts of 500,000 and 1,000,000 are included because the request asked for them. They are unlikely in a single mid-size hospital unless old records are migrated in.

| Patient record volume | Potential bottleneck | Relevant query/API | Risk | Recommended improvement |
|---|---|---|---|---|
| 10,000 | Case-insensitive substring search may already scan the whole patient table. Daily lists and token allocation stay on indexed, small daily sets. | `GET /api/patients/search`, `GET /api/billing/patients` | Medium for search. Low for registration and today’s lists. | Add trigram indexes for the searched columns, or search by prefix / exact UHID and exact phone. Keep the 50-row page. |
| 50,000 | Search `count` plus page query both scan. A custom admin report covering many months loads every visit in that window into memory. One patient’s full history is still small. | search APIs; `GET /api/reports/admin`; `GET /api/reports/receptionist` | Search: medium to high. Reports: medium if users run long custom ranges during OPD. | Cap report ranges. Aggregate gender, age, and scheme in SQL. Return detail pages instead of every visit. |
| 100,000 | Search latency becomes the desk-facing risk. Report queries over a year of visits dominate RAM and hold a pooled connection. Registration of a new patient stays a handful of queries. | same as above; billing `getReport` if bill volume tracks visits | High for interactive search and for unbounded reports. Low for single-row token and patient insert if those queries stay indexed. | Same index and report changes. Set `statement_timeout`. Give reports a separate connection limit so a report cannot occupy every pooled connection. |
| 500,000 | Full-table search patterns and unpaginated history reports are the scaling wall. B-tree indexes on visit date still keep “today” small. | search; admin report; `getPatientVisitHistory` only if misused as a global list (it is per patient) | High for search and all-history reports. Today’s OP and token counter remain row-limited. | Do not rely on `%term%` search at this size. Partitioning is optional and should wait until a measured plan shows date indexes are insufficient. |
| 1,000,000 | Same patterns, larger scans and larger report payloads. Autovacuum and index bloat become operational concerns. This volume was not modelled numerically. | search; custom reports; refresh-token table if logins are never purged | High for the unbounded paths. Ordinary primary-key reads stay cheap. | Measure with `EXPLAIN` on a copy of real or synthetic data on the hospital server. Purge expired refresh tokens. Review vacuum and disk. |

Visit-table growth matters more than patient-table growth for reports. A search problem appears on `Patient`. A report problem appears on `PatientVisit` and `Bill`.

---

## 7. Concurrency and race condition analysis

| Scenario | Assessment | Confidence |
|---|---|---|
| Several receptionists register different patients | Independent inserts. UHID uses 5 random bytes plus a unique key and 3 retries. No shared patient-number counter. | Confirmed safe in code for distinct rows. Collision probability was not measured. |
| Several receptionists register OP visits for different patients | Token SQL is atomic per department and date. Unique `(departmentId, tokenDate, tokenNumber)` rejects a duplicate number. A rolled-back visit leaves a gap in the sequence, which is safer than a duplicate. | Confirmed for token numbers. |
| Two requests register the same patient in the same department today | Both can pass `findFirst` before either inserts. Each then receives its own token. | Confirmed race. No unique constraint covers this case. |
| Two requests register the same phone | Duplicate read is outside the insert, and `phone` is not unique. | Confirmed race. |
| Two users update the same patient | Last `update` wins. No version column. | Confirmed last-write-wins. |
| Two payments on one bill | Serializable transaction and idempotency key. `addPayment` does not retry serialization failures (`P2034`). | Design looks sound. Needs runtime validation. |
| Reports during registration | Readers do not take the token-row lock. A large report can still hold a pooled connection and slow other work. | Potential resource contention. |
| Simultaneous refresh | Rotation uses `updateMany` and accepts only `count === 1`. A second tab that loses receives 401, and the controller clears the refresh cookie. | Confirmed for the cookie-clear path. Practical impact needs two clients refreshing the same cookie. |
| Scheme math under concurrency | Discount is computed from the scheme row inside the request. Two visits do not share a mutable discount counter. | Confirmed for calculation. A scheme edit during a visit can change the rate the visit reads. |

Login lock updates are read-modify-write without a transaction. Two parallel failures can record the same `failedAttempts` value. Impact is a slightly late lock, not a data-corruption path.

---

## 8. OP token generation safety

**Token numbers: the implementation is concurrency-safe in source.**

- File: `Backend/src/modules/visits/visitService.js`
- Function: `registerVisitRecord`
- Operation: `tx.$queryRaw` `INSERT INTO "DailyTokenCounter" ... ON CONFLICT ("departmentId", "tokenDate") DO UPDATE SET "nextToken" = "DailyTokenCounter"."nextToken" + 1 RETURNING "nextToken"`
- Assigned number: `Number(tokenRows[0].nextToken) - 1`
- Safety net: `@@unique([departmentId, tokenDate, tokenNumber])` on `PatientVisit`, created in `Backend/prisma/migrations/20261003140000_department_daily_token_counter/migration.sql`
- On that unique violation the API returns `TOKEN_ASSIGNMENT_FAILED`

Two receptionists registering different patients at the same time should receive different token numbers for the same department and day. This was not executed concurrently, so it remains a code conclusion, not a timed test.

**Same patient, same department, same day: not safe.**

`sameDayVisit` is a `findFirst` inside the transaction with no `SELECT FOR UPDATE` and no partial unique index. PostgreSQL’s default read committed isolation, which Prisma uses when no isolation level is set, does not stop both transactions from seeing “no row” and both inserting. They will not share a token number. They can create two OP visits and two tokens.

A second defect in the same `catch`: any other `P2002` is reported as `DUPLICATE_SAME_DAY_VISIT`, including a `visitNumber` collision. That message would be wrong for a visit-number conflict.

---

## 9. Patient registration safety

Different patients at the same time are safe at the database level.

The duplicate-patient rule is only “same normalized phone,” implemented in `registerPatientRecord` and `updatePatientRecord`:

- The lookup uses `findMany` with `take: 10`, then the code throws `PATIENT_DUPLICATE_PHONE`.
- The insert is a later statement.
- `Patient.phone` is not unique.
- If phone and alternate phone are both empty, the duplicate query is skipped.
- Name, gender, and date of birth are not part of a uniqueness rule.
- Billing registration uses this same function, so the same gap exists on `/api/billing/patients`.

UHID generation (`UHID-YYYYMMDD-` plus 10 hex characters) is protected by the unique index and three attempts. That part is sound.

Patient updates validate scheme eligibility on the server. They do not lock the row.

---

## 10. Payment integrity analysis

### OP visit fee

`registerVisitRecord` trusts `opFee` from the request (`min 0`, `max 100000`). Discount is then computed on the server from the active scheme and capped at the fee. `finalFee` is stored on the visit as `PAID` or `FREE`. There is no OP payment table, idempotency key, or reversal.

A direct API call can send `opFee: 0` and record a free visit even when the desk UI shows a fixed fee. The UI is not the control.

### Hospital bills

`calculateBill` loads current tariffs, validates patient scheme eligibility, and applies the fixed 100% scheme discount without accepting client-supplied prices or discounts. Idempotency keys on `Bill` and `BillPayment` make a repeated submit return the original row when the payload matches. Overpayment is rejected inside the payment transaction. Reversal is admin-only and writes `BillingAudit`.

`category` (`APL` or `BPL`) is chosen by the client in `billInputSchema`. The server applies that category’s tariff. Nothing in `getBillablePatient` checks that the patient is eligible for BPL. A direct request can select the lower tariff.

`createBill` calculates the amount before the write transaction. A tariff edited in that gap can be snapshotted at the pre-transaction price. The bill row then keeps that snapshot, so the receipt stays internally consistent.

`addPayment` and `reversePayment` do not retry `P2034`. A second concurrent payment can fail and must be resubmitted. That is preferable to a double charge. It still needs a runtime check under serializable isolation.

---

## 11. Node.js memory and CPU risks

What stays small at 25–30 active desks:

- Paginated patient and today’s visit lists (at most 50 rows, with related scheme or department).
- Single-patient and single-visit reads.
- Bill create for at most 100 service lines.
- Dashboard profile read.
- bcrypt on login.

What can grow without a row cap:

- `generateAdminReceptionReport` holds every visit in the range, with names, phone, UHID, fees, and staff names, then also builds `detailRows`.
- `generateReceptionistReport` holds every visit for one receptionist, with a smaller `select`.
- `getReport` in billing holds every bill, its items, and the payment list. The nested staff loop calls `payments.filter` per staff member.
- `getPatientVisitHistory` holds every visit for one patient and repeats the patient object.

There is no in-process cache that grows forever, no `setInterval` in the backend, and no file upload API. The Prisma client is a singleton, so connections are not opened per request and then abandoned. A long report still occupies one pooled connection until it finishes.

At 25–30 clients, normal registration traffic is a small number of short queries. The risky moment is several people opening a long custom report while OPD registration continues. Pool size is unspecified. Prisma’s default is about `CPU cores * 2 + 1` for one process. On a 4-core server that is on the order of 9 connections. A few heavy reports can queue registration behind them. That queue length was not measured.

Excel catalog import can use CPU and RAM, and it runs as a script, not as a desk request.

---

## 12. Report generation scalability

| Report | Date filter in SQL | Aggregation | Unbounded detail load | Range cap |
|---|---|---|---|---|
| Receptionist, `generateReceptionistReport` | yes, `visitDate` | payment totals in SQL; gender, age, and department counts in Node over every visit | yes | no |
| Admin, `generateAdminReceptionReport` | yes | SQL `aggregate` and `groupBy` for fees, staff, department, visit type; gender, age, and scheme counts again in Node | yes, and the response includes `visits: detailRows` | no |
| Billing, `getReport` | yes, `createdAt` / payment times | totals in Node over all bills and payments | yes, response includes every bill summary | 366 days |

Reception reports do not select the whole patient row. Admin reports do select identity fields the summary does not need for the aggregate, because the API also returns a line for every visit.

Scheme totals on the admin report use `visit.patient.scheme`, the patient’s scheme now, not `schemeIdAtVisit`. A scheme change rewrites history in the report.

Most likely to slow down as history grows, in order:

1. `GET /api/reports/admin` on monthly or custom ranges.
2. `GET /api/billing/reports` on long ranges, because each bill includes items.
3. `GET /api/reports/receptionist` for one user over a long custom range.

Suggested changes, not applied:

- Require a maximum custom span on reception reports, matching the billing 366-day guard or a tighter OPD window.
- Compute gender, age band, and scheme with SQL `GROUP BY` or filtered counts.
- Page the visit and bill detail lists.
- Read scheme from the visit snapshot.
- Run reports with a statement timeout.

---

## 13. Network and VPN architecture assessment

One central computer for React, Node, and PostgreSQL is a reasonable design for 25–30 desks. PostgreSQL should accept connections only from that computer, not from every desk. Desks should speak HTTP to the API only.

What the code does today:

- The API listens on all interfaces (`0.0.0.0`).
- CORS allows `http://100.103.223.11`, `http://100.103.223.11:5173`, and `http://localhost:5173`.
- Data services in the frontend use `http://100.103.223.11:5000` directly.
- Refresh and logout use `/api/...`, which Vite proxies to `127.0.0.1:5000` only when the page is loaded through the Vite server.
- `100.103.223.11` sits in `100.64.0.0/10`. That range is commonly used by overlay VPNs such as Tailscale. The repository does not record whether this host is on an overlay VPN. Pure LAN clients that cannot route to that address will fail even when the server is up.
- There is no API timeout in the client services and no server request timeout in `server.js`.
- Cookie `secure` is set only when the request is HTTPS. The allowed origins are HTTP, so the refresh cookie will travel in clear text on this network.
- One server is a single point of failure. Nothing in the repo provides a second node or a standby database.

LAN clients and VPN clients sharing one API is fine when both can reach the same host and the same CORS origin. It fails when some PCs use a LAN name, some use the overlay address, and the client has only one address compiled in. VPN adds delay to every round trip. Chatty screens that search on each keystroke would feel that delay first. This UI’s search behaviour was not timed.

Session model: short access token in `localStorage`, rotating refresh cookie. That works across desks. It does not survive an XSS bug, and `helmet` is not enabled.

---

## 14. Security and data integrity findings

Server-side Zod is present on the main write paths. The frontend is not treated as the only validation layer for names, phones, scheme eligibility, bill line identity, or payment size.

Rules a caller can still bypass by calling the API directly:

- OP fee amount.
- Billing category `APL` / `BPL`.
- Same-day duplicate visit, under concurrency.
- Duplicate patient when the phone check races, or when phone is omitted.
- Role lookup without a password.

JWT role is trusted until the 15-minute access token expires. Disabling a user does not revoke access tokens already issued. Refresh checks `user.status` and whether the role is still assigned.

Patient routes are role-gated and there is no per-patient ownership. Any receptionist can open any patient. That matches a shared reception desk. It is broad if reception accounts are shared or left unlocked.

`GET /api/auth/me` returns the JWT payload. Passwords are bcrypt-hashed and are not selected in the dashboard profile. `.env.example` shows `JWT_SECRET = HospitalSecretKey` as a placeholder. The live secret was not opened for this audit. A placeholder of that form must not be the production secret.

---

## 15. Potential application bottlenecks

1. Patient and billing patient search (`contains` across several text columns, plus `count`).
2. Admin reception report over wide dates.
3. Billing report over wide dates, including bill items.
4. Department visit history used as a count, inside and before OP registration.
5. Unconfigured Prisma pool when a report and OPD traffic overlap.
6. Hardcoded API host, which becomes an outage for any desk that cannot route to it.
7. Single Node process and single database on one PC.

Today’s lists, token allocation, and single-record reads are not the expected bottleneck at 30 users.

---

## 16. Hardware recommendations

These are preliminary planning ranges for one machine running PostgreSQL, one Node process, and the web UI for about 25–30 desks. They are not a certification that any listed machine supports 30 users. CPU model names below are examples of a class, not a required SKU.

| | Minimum to investigate | Recommended to investigate | Higher capacity |
|---|---|---|---|
| CPU class | 4-core desktop or server CPU from about 2021 onward (for example Core i3 / Ryzen 3 class, or Xeon E / Ryzen 5 entry) | 6–8 cores (Core i5 / Ryzen 5 or Xeon E-2300 / Ryzen 5 Pro class) | 8–12 cores (Xeon E-2400 or Ryzen 7 Pro class) |
| Physical cores | 4 | 6–8 | 8–12 |
| Threads | 4–8 | 12–16 | 16–24 |
| RAM | 16 GB | 32 GB | 64 GB |
| SSD | SATA SSD, 500 GB, dedicated to OS and PostgreSQL | NVMe SSD, 1 TB | NVMe SSD, 1 TB or more, with a separate backup disk |
| Network | Gigabit Ethernet | Gigabit Ethernet, wired desks | Gigabit, wired, switch with enough ports for every desk |
| OS | A supported Windows Server or Linux release the hospital can patch | Same, with a maintenance window | Same |

How the resources are used:

- CPU: bcrypt at login, JSON report building, and PostgreSQL sorts and scans. OP registration itself is light.
- RAM: PostgreSQL cache first, then Node heap when a report materializes a large array. 16 GB is the floor only if reports stay on short dates. 32 GB leaves room for cache plus a bad report.
- SSD: random reads for indexes and writes for visits and bills. A spinning disk is a poor fit. Capacity of a few hundred GB is enough for this schema for many years at typical OPD volume; the 1 TB system disk is about headroom and the database files living away from the backup disk.
- Network: 30 clients sending small JSON pages is well inside Gigabit. VPN overhead matters more than bandwidth.
- Connection pool: start near 10–20 Prisma connections on this single process, below PostgreSQL `max_connections`, and keep a reserve so admin tools can still connect. Set `statement_timeout` (for example 5–10 seconds for desk APIs, longer only for reports). These numbers are starting points to measure, not tuned results.

PostgreSQL settings to set on the real server and then measure: `shared_buffers` around one quarter of RAM on a dedicated machine, `effective_cache_size` around half to three quarters of RAM, `work_mem` kept modest so 20 sorts cannot exhaust RAM, `max_connections` only high enough for the pool plus administrators, and autovacuum left on.

What must be measured later on the hospital server, using a copy of the database or a staged dataset, not the only live copy:

- `EXPLAIN (ANALYZE, BUFFERS)` for patient search, today’s visits, and a monthly admin report.
- Pool wait time while a report and registrations run together.
- Backup duration and restore time.
- Disk growth after a representative month.
- Behaviour of token allocation and same-day registration with a small controlled concurrency test, after the missing unique rule is added.

---

## 17. Backup and storage assessment

The repository contains no backup script, schedule, retention rule, checksum check, or restore procedure. No code writes backups to a second 1 TB SSD. Application files and the database therefore depend on whatever the operating system administrator does outside this project.

A separate 1 TB SSD is large enough for many years of compressed PostgreSQL dumps of this schema at hospital OPD volume, plus several retained copies. Capacity is not the gap. The gap is the absence of a method.

A workable hospital approach, to be implemented outside this audit:

- Nightly `pg_dump` custom-format dump to the second disk, plus a copy off the server if policy allows.
- WAL archiving or a daily base backup if the hospital needs point-in-time recovery. Dumps alone lose changes since the last dump.
- Keep at least 7 daily and 4 weekly copies, then confirm disk alerts before the disk fills.
- Restore a dump onto a spare folder or spare machine on a schedule and read a known patient and bill. A backup that has never been restored is an unverified file.
- Do not store the only backup on the same SSD as PostgreSQL.

This audit did not run a backup or a restore.

Database growth is dominated by `Patient`, `PatientVisit`, `Bill`, `BillItem`, `BillPayment`, and `BillingAudit`. Refresh tokens grow with sessions until they are deleted. None of these tables store documents. Exact bytes per row were not measured.

---

## 18. Required code improvements

Priority order is in section 20 and in the conclusion. No change was made.

1. Make one active OP visit per patient, department, and day a database constraint, and keep the existing same-day check as a friendly error.
2. Stop accepting an arbitrary OP fee, or restrict it to the configured fee.
3. Decide BPL eligibility on the server.
4. Bound reception and admin report ranges, and stop returning every visit in one response.
5. Move gender, age, and scheme summaries to SQL, using the visit’s scheme snapshot.
6. Replace or support patient `contains` search with an index-friendly strategy.
7. Put phone duplicate detection in a transaction with a unique rule, and define what “no phone” means.
8. Retry serialization failures on bill payments, as bill creation already does.
9. Point the frontend at one configurable API origin. Serve the built UI and the API on that origin so refresh cookies and data calls match.
10. Mount `helmet`, stop returning raw internal errors, add a request timeout, and set a statement timeout.
11. Remove or protect `GET /api/auth/roles`.
12. Allow `ADMIN` on `/api/dashboard/me` if admins use the billing home, or stop that page from calling it for admins.
13. Delete expired refresh tokens.
14. Count prior visits with `count` instead of loading every row during OP registration.

---

## 19. Required database improvements

1. Partial unique index for a non-cancelled visit: patient, department, and token date (or a stored visit day). This is the constraint that makes the same-day rule true under concurrency.
2. Trigram or equivalent indexes on the columns actually searched, if substring search remains a requirement.
3. Index `Patient.updatedAt` only if search continues to sort by it after the search predicate is selective.
4. Optional composite for payment summaries: `(visitDate, paymentStatus, paymentMethod)`.
5. Drop clearly redundant indexes only after a migration plan: standalone `PatientVisit.visitDate` if `(visitDate, tokenNumber)` remains; `DailyTokenCounter.departmentId` if the unique pair remains. Confirm with `EXPLAIN` first. This audit did not drop anything.
6. Unique index on normalized phone only if the hospital decides phone is mandatory and unique. A partial unique index cannot represent “either phone or alternate phone.”
7. Scheduled delete of expired `refresh_tokens`.
8. `statement_timeout` and explicit Prisma `connection_limit` in the deployment environment, not necessarily in a migration.

---

## 20. Deployment readiness assessment

**Not ready for a live hospital cutover.**

Suitable architecture, useful constraints, and careful billing transactions are already in the code. The remaining blockers are operational and a short list of integrity gaps: same-day visit uniqueness, client-controlled OP fee and BPL category, unbounded reports, search that will not use the current indexes, no backup procedure, hardcoded host, and secrets and HTTP left to the deployment environment.

A single well-provisioned PC can host this workload for 30 desks after those items are addressed and then measured. This inspection cannot certify that.

---

## Issue register

### Issue 1 — Same-day OP visit race

| Field | Details |
|---|---|
| Issue | Two concurrent OP registrations for the same patient and department can both succeed |
| Severity | High |
| Source file | `Backend/src/modules/visits/visitService.js` |
| Function | `registerVisitRecord` |
| Problem | Same-day protection is `findFirst` followed by `create`, with no unique index and no row lock |
| Failure scenario | Two receptionists, or a double-submitted form, register one patient into one department at the same moment |
| Impact | Two tokens, two fees, and two queue entries for one visit |
| Recommendation | Add a partial unique index on active visits for `(patientId, departmentId, tokenDate)` and map that unique violation to the existing duplicate error |
| Evidence | `sameDayVisit` query around the department-token block; schema unique keys cover visit number and token number only |
| Confidence | Confirmed as a code race. Not executed. |

### Issue 2 — Token numbers

| Field | Details |
|---|---|
| Issue | Daily token allocation |
| Severity | Low for duplicate numbers. A failed transaction can skip a number. |
| Source file | `Backend/src/modules/visits/visitService.js` |
| Function | `registerVisitRecord` |
| Problem | None found for duplicate token numbers. The counter update is atomic and the visit unique key matches it. |
| Failure scenario | Two receptionists register different patients in one department at the same time |
| Impact | Distinct token numbers. A rollback after the counter update leaves a gap. |
| Recommendation | Keep this SQL. Add the same-day patient constraint separately. Run one small concurrency test on the hospital server later. |
| Evidence | `INSERT ... ON CONFLICT ("departmentId", "tokenDate") DO UPDATE` and `@@unique([departmentId, tokenDate, tokenNumber])` |
| Confidence | Confirmed in source. Runtime timing not measured. |

### Issue 3 — Patient search scans

| Field | Details |
|---|---|
| Issue | Substring search will not use the existing B-tree indexes |
| Severity | High |
| Source file | `Backend/src/modules/patients/patientService.js`; `Backend/src/modules/billing/billingService.js` |
| Function | `searchPatients`; `searchBillingPatients` |
| Problem | `contains` with `mode: "insensitive"` on several columns, plus a full `count`, plus `orderBy updatedAt` |
| Failure scenario | Name or phone search after the patient table is large, especially `field=all` |
| Impact | Slow reception and billing search while registration itself still works |
| Recommendation | Trigram indexes, or exact/prefix search on UHID and phone. Avoid leading-wildcard search on every keystroke. |
| Evidence | `patientSearchSchema` limits the page to 50, which limits the response only. Migrations show B-tree indexes, not `pg_trgm`. |
| Confidence | Confirmed query shape. Latency at each volume was not measured. |

### Issue 4 — Unbounded reports

| Field | Details |
|---|---|
| Issue | Activity and billing reports load the whole date range into Node.js |
| Severity | High |
| Source file | `Backend/src/modules/reports/reportService.js`; `Backend/src/modules/billing/billingService.js` |
| Function | `generateAdminReceptionReport`; `generateReceptionistReport`; `getReport` |
| Problem | `findMany` without `take`. Admin and billing responses include every detail row. Gender and age are counted in JavaScript. Reception reports have no maximum span. Billing custom range stops at 366 days. |
| Failure scenario | Monthly or multi-month report while OPD is running, possibly from more than one desk |
| Impact | Large JSON, large Node heap, pooled connections held, other desks wait |
| Recommendation | Cap ranges, aggregate in SQL, paginate details, use visit scheme snapshots |
| Evidence | `visits` and `bills` arrays built from unbounded queries; `buildReportRange` rejects spans over 366 days; `buildDateRange` in the reception report service does not |
| Confidence | Confirmed in source. Memory use was not measured. |

### Issue 5 — Client-supplied OP fee

| Field | Details |
|---|---|
| Issue | OP charge is whatever the client sends |
| Severity | High |
| Source file | `Backend/src/modules/visits/visitService.js` |
| Function | `registerVisitRecord` / `registerVisitSchema` |
| Problem | `opFee` is a client number from 0 to 100000. The server only calculates the scheme discount on top of it. |
| Failure scenario | Direct `POST /api/visits` with `opFee: 0` or an inflated fee |
| Impact | Free or incorrect OP revenue, stored as `PAID` or `FREE` with no separate payment record |
| Recommendation | Use a server-side department or hospital fee. Keep discount calculation on the server. |
| Evidence | `registerVisitSchema` and the `finalFee = opFee - discountAmount` block |
| Confidence | Confirmed |

### Issue 6 — Client-supplied billing category

| Field | Details |
|---|---|
| Issue | APL versus BPL tariff is chosen by the request |
| Severity | High |
| Source file | `Backend/src/modules/billing/billingService.js` |
| Function | `quoteBill`; `createBill`; `calculateBill` |
| Problem | `category` defaults to `APL` and may be `BPL` with no eligibility check |
| Failure scenario | Direct bill request selects `BPL` for a patient who should pay APL rates |
| Impact | Undercharge, with the chosen tariff copied onto the bill |
| Recommendation | Derive category from an authorized patient attribute or require an admin override that is audited |
| Evidence | `billInputSchema.category`; `serviceData(service, category)` |
| Confidence | Confirmed |

### Issue 7 — Phone duplicate check

| Field | Details |
|---|---|
| Issue | Duplicate patients can be stored |
| Severity | Medium |
| Source file | `Backend/src/modules/patients/patientService.js` |
| Function | `registerPatientRecord`; `updatePatientRecord` |
| Problem | Check-then-act, no unique phone, no check when phone is empty, lookup limited to 10 rows |
| Failure scenario | Two desks register the same phone at the same time, or a patient is saved with no phone |
| Impact | Duplicate charts and split visit history |
| Recommendation | Define the hospital’s identity rule, then enforce it inside a transaction with a constraint |
| Evidence | `possibleDuplicates` block and optional `phone` on `Patient` |
| Confidence | Confirmed |

### Issue 8 — Historical scheme figures use the current scheme

| Field | Details |
|---|---|
| Issue | Admin report scheme breakdown follows the patient master, not the visit snapshot |
| Severity | Medium |
| Source file | `Backend/src/modules/reports/reportService.js` |
| Function | `generateAdminReceptionReport` |
| Problem | `visit.patient.scheme` is accumulated even though `PatientVisit` stores `schemeIdAtVisit` and `schemeNameAtVisit` |
| Failure scenario | Staff change a patient’s scheme after the visit |
| Impact | Old OP reports change |
| Recommendation | Group by the snapshot columns |
| Evidence | scheme loop uses `visit.patient?.scheme`; snapshot columns exist on `PatientVisit` |
| Confidence | Confirmed |

### Issue 9 — Payment serialization retry gap

| Field | Details |
|---|---|
| Issue | Concurrent bill payments can fail instead of retrying |
| Severity | Medium |
| Source file | `Backend/src/modules/billing/billingService.js` |
| Function | `addPayment`; `reversePayment` |
| Problem | Isolation is `Serializable`, and unlike `createBill` there is no retry on `P2034` |
| Failure scenario | Two cashiers post against one open bill at the same time |
| Impact | One request errors. A careful retry should then see the updated balance. A silent double charge is not what this code does. |
| Recommendation | Retry serialization failures the way `createBill` already does |
| Evidence | `isolationLevel: "Serializable"` without the `P2034` loop used in `createBill` |
| Confidence | Potential risk. Needs runtime validation. |

### Issue 10 — Pool, timeouts, and report interference

| Field | Details |
|---|---|
| Issue | Database pool and statement time are not set in application code |
| Severity | Medium |
| Source file | `Backend/src/config/prisma.js`; `Backend/server.js` |
| Function | `new PrismaClient()`; `startServer` |
| Problem | Default pool, no `statement_timeout`, one process |
| Failure scenario | Long searches or reports overlap with OPD |
| Impact | Registration waits on a small connection pool |
| Recommendation | Set `connection_limit`, `statement_timeout`, and PostgreSQL memory settings on the server, then measure |
| Evidence | Prisma client has no options. No PostgreSQL config file is in the repo. |
| Confidence | Confirmed configuration gap. Effect at 30 users requires runtime validation. |

### Issue 11 — Hardcoded host and split API paths

| Field | Details |
|---|---|
| Issue | Clients do not share one configurable origin |
| Severity | High for deployment |
| Source file | `Frontend/src/reception/services/patientService.js`, `visitService.js`, `reportService.js`; `Frontend/src/billing/billingApi.js`; `Frontend/src/admin/services/*`; `Frontend/src/auth/session.js`; `Frontend/vite.config.js`; `Backend/server.js` |
| Function | API constants; `performRefresh`; CORS origin list |
| Problem | Data calls use `http://100.103.223.11:5000`. Refresh uses relative `/api`, which Vite proxies only to `127.0.0.1:5000`. CORS allows that host on ports 80 and 5173, plus localhost. |
| Failure scenario | A LAN PC that cannot route to `100.103.223.11`, or a page that is not served by this Vite proxy, so refresh and data calls go to different places |
| Impact | Desks cannot log in or cannot load patients, depending on how the page was opened |
| Recommendation | One origin, environment-based, with the API and the static UI served together |
| Evidence | Hardcoded URLs and the Vite proxy target |
| Confidence | Confirmed in source. The live network path was not tested. |

### Issue 12 — Public role lookup and access-token storage

| Field | Details |
|---|---|
| Issue | Username role disclosure; bearer token in `localStorage`; HTTP refresh cookie |
| Severity | Medium |
| Source file | `Backend/src/modules/auth/authRoutes.js`; `Backend/src/modules/auth/authService.js`; `Frontend/src/auth/session.js`; `Backend/src/modules/auth/authController.js` |
| Function | `getAssignedRoles`; `getRolesForUsername`; `saveAccessToken`; `refreshCookieOptions` |
| Problem | `GET /api/auth/roles` is unauthenticated. Access JWT is in `localStorage`. `secure` cookies are off on HTTP. `helmet` is not used. |
| Failure scenario | Someone on the hospital network enumerates roles, or an XSS bug reads `localStorage` |
| Impact | Role disclosure and session theft |
| Recommendation | Require a password before revealing roles. Serve HTTPS on the hospital network or accept the LAN risk explicitly. Use helmet and a strict content security policy. |
| Evidence | Public route in `authRoutes.js`; `localStorage.setItem("token", token)`; cookie `secure` depends on HTTPS |
| Confidence | Confirmed |

### Issue 13 — Account status is not applied to existing access tokens

| Field | Details |
|---|---|
| Issue | Locking a user does not cancel a live access token |
| Severity | Medium |
| Source file | `Backend/src/middleware/authMiddleware.js`; `Backend/src/modules/auth/authService.js` |
| Function | `authenticateToken`; `loginUser` |
| Problem | APIs trust the JWT role and user id for 15 minutes. Refresh checks status. Ordinary APIs do not. |
| Failure scenario | An account is locked or a role is removed while a token is still valid |
| Impact | Up to 15 minutes of continued access |
| Recommendation | Check user status on sensitive writes, or keep a token version |
| Evidence | `jwt.verify` result is stored on `req.user` with no database read |
| Confidence | Confirmed |

### Issue 14 — Internal errors returned to the client

| Field | Details |
|---|---|
| Issue | Unexpected exceptions are sent as `error.message` |
| Severity | Low |
| Source file | `Backend/src/modules/patients/patientController.js` and the other controllers with the same pattern |
| Function | `searchPatients`, `getPatientDetails`, and similar catch blocks |
| Problem | Prisma messages can describe tables and constraints |
| Failure scenario | A database error on search or update |
| Impact | Information useful to anyone who can call the API |
| Recommendation | Log the detail on the server and return a generic message for 500s |
| Evidence | `message: error.message` on the 500 branch |
| Confidence | Confirmed |

### Issue 15 — Visit history loaded to count it

| Field | Details |
|---|---|
| Issue | OP registration reads every previous visit in the department |
| Severity | Low at normal per-patient counts; medium if history is imported in bulk |
| Source file | `Backend/src/modules/visits/visitService.js` |
| Function | `registerVisitRecord`; `getPatientDepartmentVisitHistory` |
| Problem | `findMany` of full rows, then `.length`, with no `take` |
| Failure scenario | A patient with a very long department history is registered during a busy hour |
| Impact | Longer transaction before the token row is updated |
| Recommendation | `count` queries for prior visits and for today’s visit |
| Evidence | `previousVisits` and `visitsToday` queries |
| Confidence | Confirmed |

### Issue 16 — Refresh-token table growth

| Field | Details |
|---|---|
| Issue | Expired and rotated refresh tokens are kept |
| Severity | Low |
| Source file | `Backend/src/modules/auth/authService.js` |
| Function | `issueRefreshToken`; `refreshSession` |
| Problem | Every login and refresh inserts a row. Revocation sets `revokedAt` and does not delete. |
| Failure scenario | Years of sessions on one server |
| Impact | Larger `refresh_tokens` table. Not an OPD bottleneck at 30 users in the first years. |
| Recommendation | Delete rows that are expired or revoked beyond a retention window |
| Evidence | `prisma.refreshToken.create` with no cleanup job |
| Confidence | Confirmed |

### Issue 17 — Admin billing home calls a route that rejects ADMIN

| Field | Details |
|---|---|
| Issue | `/api/dashboard/me` allows reception and billing only |
| Severity | Low |
| Source file | `Backend/src/modules/dashboard/dashboardRoutes.js`; `Frontend/src/billing/BillingHome.jsx` |
| Function | dashboard route; `BillingHome` load |
| Problem | Admin may open `/billing`, and that home page calls `/api/dashboard/me` |
| Failure scenario | Admin uses the billing module home |
| Impact | Home profile request returns 403. Billing APIs themselves allow `ADMIN`. |
| Recommendation | Include `ADMIN` on that route or skip the call when the role is admin |
| Evidence | `requireRole("RECEPTION", "BILLING")` versus billing routes that include `ADMIN` |
| Confidence | Confirmed |

### Issue 18 — No backup implementation

| Field | Details |
|---|---|
| Issue | Backup and restore are not implemented in the project |
| Severity | Critical for hospital operations, as an operational gap rather than a code defect in billing math |
| Source file | Repository-wide. No backup script under `Backend/scripts` or elsewhere. |
| Function | n/a |
| Problem | A second 1 TB SSD is only a planned disk. The application never writes to it. |
| Failure scenario | Disk failure, ransomware, or a bad migration on the only server |
| Impact | Loss of registration, tokens, and payments since the last manual copy, or total loss if none exists |
| Recommendation | Scheduled `pg_dump` or base backup plus WAL, retention, and a tested restore |
| Evidence | Scripts present are `seed.js` and `import-billing-catalog.js` only |
| Confidence | Confirmed absence in source. Live server backup jobs were not inspected. |

### Issue 19 — Single server

| Field | Details |
|---|---|
| Issue | One computer runs the UI, API, and database |
| Severity | Medium |
| Source file | `Backend/server.js` |
| Function | `startServer` |
| Problem | One process, one database, no standby in the repo |
| Failure scenario | Hardware, power, or Windows update during OPD |
| Impact | All 30 desks stop |
| Recommendation | Accept this for a single hospital only with backup power, monitored disk, and a tested restore. Document who starts the processes after a reboot. |
| Evidence | One `app.listen` and one Prisma client |
| Confidence | Confirmed architecture |

### Issue 20 — JWT secret placeholder

| Field | Details |
|---|---|
| Issue | Example secret is a short static string |
| Severity | Critical if that value is used in production. Unknown for the live environment. |
| Source file | `Backend/.env.example` |
| Function | `signAccessToken` uses `process.env.JWT_SECRET` |
| Problem | The example is `HospitalSecretKey` |
| Failure scenario | The deployed environment copies the example |
| Impact | Forged access tokens for any role |
| Recommendation | Long random secret, not committed, rotated if it was ever the example value |
| Evidence | `.env.example` line `JWT_SECRET = HospitalSecretKey`. The live `.env` was not read. |
| Confidence | Confirmed in the example. Requires deployment validation. |

---

## Large dataset scalability table

| Patient record volume | Potential bottleneck | Relevant query/API | Risk | Recommended improvement |
|---|---|---|---|---|
| 10,000 | Substring search scans; daily OP and tokens stay indexed | `GET /api/patients/search`, `GET /api/billing/patients` | Medium for search | Trigram or exact/prefix search |
| 50,000 | Search scans plus long custom reports materializing visits | search APIs; `GET /api/reports/admin` | Medium to high | Cap and paginate reports; SQL aggregates |
| 100,000 | Search and year-long reports dominate; pool can stall on report connections | search; admin report; `GET /api/billing/reports` | High on those paths | Indexes, timeouts, separate report limits |
| 500,000 | Leading-wildcard search and full-range detail exports | same endpoints | High on those paths | Stop unbounded detail exports; measure plans on a copy |
| 1,000,000 | Same patterns at larger size; vacuum and disk become part of operations | search; reports; `refresh_tokens` if never purged | High on unbounded paths; low on primary-key reads | Measure on the target server before importing history |

No response times are stated because none were measured.

---

## 12. Final conclusion

1. **Is the architecture suitable for centralized hospital hosting?**  
   Yes, as a single API and a single PostgreSQL database on one hospital computer, with desks as clients. It is suitable only after the integrity gaps, report bounds, search strategy, backup, and host configuration are in place.

2. **Are there critical code-level problems?**  
   The highest code risks are the same-day visit race, client-controlled OP fee, client-controlled BPL category, and unbounded reports. The highest operational risk is the lack of a backup and restore process. Duplicate OP token numbers are not the critical defect.

3. **Can patient search scale to a large database?**  
   The page size is capped at 50, so the browser payload stays small. The database work is a case-insensitive substring scan plus a count. That shape does not scale on the current indexes. Exact UHID and exact phone lookups would.

4. **Are database queries appropriately optimized?**  
   Today’s lists, token allocation, bill keys, and visit date filters are indexed. Search, full visit history used only for a count, and report detail loads are not.

5. **Is OP token generation safe under concurrency?**  
   Yes for distinct token numbers, based on the atomic counter and the unique constraint. This was not run under real concurrency. It does not stop two visits for the same patient on the same day.

6. **Can multiple receptionists register different patients at the same time?**  
   Yes. Those inserts do not share a counter. Registering the same phone at the same time, or the same patient into the same department today, still has a race.

7. **Can reports become a memory bottleneck?**  
   Yes. Admin, receptionist, and billing reports load every matching row into Node and return large JSON. That is a code fact. The heap size at a given month of data was not measured.

8. **Are there payment or data integrity issues?**  
   Bill totals and bill payment idempotency are implemented carefully. OP fees and the APL/BPL choice are not protected from a direct API client. Scheme discounts on both paths are calculated on the server. Admin scheme statistics can drift from the visit snapshot.

9. **Most important improvements before deployment**  
   1. Unique rule for one active OP visit per patient, department, and day.  
   2. Server-side OP fee and server-side billing category.  
   3. Backup, retention, and a tested restore onto the separate disk.  
   4. Bound and paginate reports; aggregate in SQL.  
   5. Make patient search index-friendly.  
   6. One configured site origin, a real JWT secret, and statement/pool limits.  
   7. Enforce patient identity with a constraint if the hospital requires it.  
   8. Retry serializable payment conflicts.  
   9. Helmet, generic 500s, refresh-token cleanup.  
   10. Only then, a small runtime test on the hospital server.

10. **Server specifications to investigate**  
   Start the evaluation at 6–8 cores, 32 GB RAM, NVMe for the database, Gigabit Ethernet, and a separate 1 TB backup disk. Treat 4 cores and 16 GB as a minimum to test, not as a known-safe target. Record pool size, statement timeout, backup duration, search plans, and a monthly report while a few registration requests run.

11. **Risks that need runtime testing**  
   Actual search and report times at 10,000 patients and above. Memory during a monthly admin report. Pool queueing. Token behaviour under a deliberate concurrent registration test. Serializable payment conflicts. Whether the live JWT secret, HTTPS choice, backup job, and route to `100.103.223.11` match this repository. VPN versus LAN latency.

No application code, schema, or migration was changed. No load test should run until these findings are accepted and any code changes are approved separately.
