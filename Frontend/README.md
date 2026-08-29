# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

This repository contains a React/Vite frontend and an Express/Prisma backend backed by PostgreSQL.

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
## 1. Install the prerequisites

The following applications are required on the machine running the POC:

- **Node.js 20.19+ or 22.12+**: install the LTS version from [nodejs.org](https://nodejs.org/). npm is included with Node.js.
- **PostgreSQL**: install PostgreSQL from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/). Remember the password entered for the `postgres` user during installation.
- **pgAdmin 4**: it is included with the PostgreSQL Windows installer. It can also be installed separately from [pgadmin.org/download](https://www.pgadmin.org/download/).
- **Git**: install from [git-scm.com](https://git-scm.com/downloads) if the project is being cloned rather than copied locally.

Confirm Node.js and npm are available in PowerShell:

```powershell
node --version
npm --version
```

## 2. Open the project

Clone or copy the project, then open PowerShell in the repository folder:

```powershell
cd C:\DevelopMents\Hospital-Management
```

The repository has two separate applications. Install their dependencies independently:

```powershell
cd Backend
npm install

cd ..\Frontend
npm install
```

## 3. Create the PostgreSQL database in pgAdmin

1. Start **pgAdmin 4** and unlock it with the pgAdmin master password.
2. In the left tree, expand **Servers** and select the PostgreSQL server installed on the machine. Enter the PostgreSQL server password if prompted.
3. Right-click **Databases**, choose **Create > Database**.
4. Set the database name to `hospital_management`.
5. Leave the owner as `postgres`, then select **Save**.

The default local PostgreSQL values are usually:

| Setting | Value |
| --- | --- |
| Host | `localhost` |
| Port | `5432` |
| Database | `hospital_management` |
| User | `postgres` |
| Password | The password chosen during PostgreSQL installation |

If PostgreSQL was installed with a different port, use that port in the connection string in the next step.

## 4. Configure the backend

Create a file named `.env` directly inside the `Backend` folder. Do not commit this file or share the real secret values.

```env
DATABASE_URL="postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/hospital_management?schema=public"
PORT=5000
JWT_SECRET="replace-this-with-a-long-random-secret"
```

Replace `YOUR_POSTGRES_PASSWORD` with the PostgreSQL password. If the password contains characters such as `@`, `:`, `/`, or `#`, URL-encode those characters in `DATABASE_URL`.

## 5. Create the database tables

Run these commands from the `Backend` folder:

```powershell
cd C:\DevelopMents\Hospital-Management\Backend
npx prisma generate
npx prisma migrate deploy
```

`prisma generate` creates the Prisma client used by the server. `prisma migrate deploy` applies the checked-in migration and creates the `roles` and `users` tables.

For local schema development, use `npx prisma migrate dev` instead of `migrate deploy`.

## 6. Add the POC user

From the `Backend` folder, run:

```powershell
npm run seed
```

The seed creates the default `ADMIN` role and administrator account:

| Field | Value |
| --- | --- |
| Username | `admin` |
| Password | `admin123` |
| Employee ID | `EMP001` |

These credentials are for the POC only and must be changed before any production use.

## 7. Start the applications

Use two PowerShell windows.

**Terminal 1: backend API**

```powershell
cd C:\DevelopMents\Hospital-Management\Backend
npm start
```

The backend should report a successful PostgreSQL connection and listen on `http://localhost:5000`.

**Terminal 2: frontend**

```powershell
cd C:\DevelopMents\Hospital-Management\Frontend
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

## 8. Verify the API

With the backend running, test the login endpoint from PowerShell:

```powershell
Invoke-RestMethod -Method Post `
	-Uri http://localhost:5000/api/auth/login `
	-ContentType 'application/json' `
	-Body '{"username":"admin","password":"admin123"}'
```

A successful response contains a JWT token and the administrator user details.

## Common problems

- **`P1001` or PostgreSQL connection failed**: confirm PostgreSQL is running, the database `hospital_management` exists, and the password/port in `Backend\.env` are correct.
- **`Environment variable not found: DATABASE_URL`**: confirm the file is named exactly `.env` and is located inside `Backend`, next to `package.json`.
- **`JWT_SECRET` errors or login failures**: add a non-empty `JWT_SECRET` to `Backend\.env`, then restart the backend.
- **Port 5000 or 5173 is already in use**: stop the process using the port, or set another backend `PORT`. Vite will offer another frontend port automatically.
- **Prisma client errors after dependency changes**: from `Backend`, run `npm install` and `npx prisma generate` again.

## Useful commands

```powershell
# Backend
cd Backend
npm start
npm run seed
npx prisma studio

# Frontend
cd ..\Frontend
npm run dev
npm run build
npm run lint
```
