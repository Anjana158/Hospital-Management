# Adding a New User: Files and Flow

## Files involved

No new folder is required for the current implementation. The feature is organized in the existing layers:

| Layer | File | Responsibility |
|---|---|---|
| React page | `Frontend/src/admin/Users.jsx` | Displays the Add New User button and modal form, stores form state, and submits the form |
| Frontend API service | `Frontend/src/admin/services/userService.js` | Sends `POST /api/users` with the JWT authorization header |
| Frontend route | `Frontend/src/App.jsx` | Makes the Users page available at `/dashboard/users` for administrators |
| Route protection | `Frontend/src/admin/ProtectedRoute.jsx` | Allows only users with the `ADMIN` role to open the admin section |
| Backend route | `Backend/src/modules/users/userRoutes.js` | Applies authentication and admin authorization, then maps `POST /` to the controller |
| Backend controller | `Backend/src/modules/users/userController.js` | Reads the request body, checks required fields, and formats the HTTP response |
| Backend service | `Backend/src/modules/users/userService.js` | Checks duplicates, verifies the role, hashes the password, and creates the database record |
| Authentication middleware | `Backend/src/middleware/authMiddleware.js` | Verifies the JWT and places its contents in `req.user` |
| Role middleware | `Backend/src/middleware/roleMiddleware.js` | Confirms that the authenticated user is an `ADMIN` |
| Database model | `Backend/prisma/schema.prisma` | Defines the `User` and `Role` tables and their relationship |
| Server registration | `Backend/server.js` | Mounts the user routes at `/api/users` |

## Required user fields

The form sends:

```text
employeeId
fullName
username
password
roleId
status
```

The backend requires `employeeId`, `fullName`, `username`, `password`, and `roleId`. If `status` is omitted, the service uses `ACTIVE`.

## Request flow

```text
Admin opens /dashboard/users
        |
        v
Users.jsx displays the user list
        |
        v
Admin clicks "Add New User"
        |
        v
Users.jsx opens the form modal
        |
        v
Admin submits the form
        |
        v
createUser(formData) in userService.js
        |
        | POST /api/users
        | Authorization: Bearer <JWT>
        v
userRoutes.js
        |
        +--> authenticateToken
        |       Verifies JWT and sets req.user
        |
        +--> requireRole("ADMIN")
        |       Confirms req.user.role is ADMIN
        |
        v
userController.addUser(req, res)
        |
        +--> Checks required fields
        |
        +--> Calls createUser(req.body, req.user.userId)
        v
userService.createUser(data, adminId)
        |
        +--> Checks employeeId uniqueness
        +--> Checks username uniqueness
        +--> Checks that roleId exists
        +--> Hashes password with bcrypt
        +--> Creates user with Prisma
        v
PostgreSQL users table
        |
        v
Controller returns 201 response
        |
        v
Users.jsx closes modal and reloads the users list
```

## Backend endpoint

```http
POST http://localhost:5000/api/users
Authorization: Bearer <JWT>
Content-Type: application/json
```

Example request body:

```json
{
  "employeeId": "EMP002",
  "fullName": "Reception Staff",
  "username": "reception1",
  "password": "temporary-password",
  "roleId": 2,
  "status": "ACTIVE"
}
```

## Successful response

The password is never returned. The service returns selected safe fields such as the new user's ID, employee ID, name, username, status, role, and creation date.

```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": 2,
    "employeeId": "EMP002",
    "fullName": "Reception Staff",
    "username": "reception1",
    "status": "ACTIVE"
  }
}
```

## Failure cases

| Situation | Result |
|---|---|
| Missing required field | `400 Bad Request` from the controller |
| Duplicate employee ID | `400 Bad Request` from the service |
| Duplicate username | `400 Bad Request` from the service |
| Invalid role ID | `400 Bad Request` from the service |
| Missing or invalid JWT | `401 Unauthorized` from authentication middleware |
| Authenticated non-admin user | `403 Forbidden` from role middleware |
| Database failure | `400 Bad Request` from the controller's catch block |

## If the feature is expanded later

For a normal change to this existing flow, edit the smallest relevant layer:

- Add a form field: `Users.jsx`, controller validation, service destructuring, and `schema.prisma` if it is persisted.
- Add a new endpoint: user route, controller function, service function, and frontend API service function.
- Add a new user-related domain: create a new module folder under `Backend/src/modules`, then register its routes in `Backend/server.js`.
- Change database structure: update `schema.prisma`, create a Prisma migration, and run `npx prisma generate`.

Keep authorization in the backend even when the frontend route is protected.
