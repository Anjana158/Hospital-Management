# HMS — Current Code Flow

> This document describes the current implemented flow and is intended to replace older project-flow documentation that marked Patient functionality as planned.

## 1. Overall Application Flow

```text
React Frontend
     │
     │ HTTP + JWT
     ▼
Node.js / Express Backend
     │
     │ Route → Auth/Role Middleware
     ▼
Controller
     ▼
Service
     ▼
Prisma Client
     ▼
PostgreSQL
```

## 2. Authentication and Authorization

```text
User
  ↓
Login UI
  ↓
Authentication API
  ↓
Credentials verified
  ↓
JWT issued
  ↓
Frontend stores/uses authenticated session
  ↓
Protected route/API request
  ↓
JWT middleware
  ↓
Role middleware
  ↓
Allowed controller/service action
```

Core application roles currently used by the project:

- ADMIN
- RECEPTION
- BILLING

Backend authorization remains the security boundary. Frontend navigation and protected routes improve the user experience but do not replace backend role checks.

## 3. Admin Flow

```text
ADMIN Login
  ↓
Admin Dashboard
  ├── User Management
  └── Patient Category Management
```

### Patient Category Management

```text
ADMIN
  ↓
Open Patient Categories
  ↓
GET category list
  ↓
Create / edit category
  ↓
POST or PATCH category API
  ↓
Prisma/PostgreSQL
  ↓
Updated category list
```

Rules:

- Category codes are unique and normalized.
- Code is immutable after creation.
- Active/inactive status is managed by ADMIN.
- `GENERAL` is protected and cannot be deactivated.
- No delete workflow was added unnecessarily.
- `discountEligible` is only a future billing flag.

## 4. Reception Patient Management Flow

```text
RECEPTION
  ↓
Open /reception/patients
  ↓
Search Patient
  ├── Found → Select patient
  │            ↓
  │         View Details
  │            ↓
  │       Edit approved fields if needed
  │
  └── Not found → Register New Patient
                   ↓
              Duplicate check
                   ↓
              Create Patient
```

### Search

```text
Search UI
  ↓
patientService
  ↓
GET /api/patients/search
  ↓
JWT + RECEPTION authorization
  ↓
Search service builds Prisma filter
  ↓
Patient results + pagination
```

Search supports:

- UHID
- Name
- Phone
- Combined search

### Registration

```text
PatientRegisterForm
  ↓
PatientManagement handler
  ↓
POST /api/patients
  ↓
JWT + RECEPTION authorization
  ↓
Registration validation
  ↓
Normalize phone values
  ↓
Validate active category
  ↓
Check possible duplicate phone records
  ├── Match found → 409 duplicate response
  └── No blocking match → generate UHID + create patient
  ↓
Return safe patient response
```

Registration decisions:

- UHID is generated server-side.
- `createdBy` is derived from the authenticated user, not the request body.
- DOB is mandatory for new registrations.
- Phone formatting may include common characters, but values are normalized to digits for storage/matching.
- Patient categories are dynamically loaded.
- GENERAL is the default selected category when available.
- Address flow is Kerala-focused, with country/state defaults and district selection.

### Patient Details

```text
Search result
  ↓
GET /api/patients/:id
        OR
GET /api/patients/uhid/:uhid
  ↓
Shared patient detail lookup
  ↓
Complete registration profile + category + status
```

### Patient Update

```text
Patient Details
  ↓
Edit mode
  ↓
PATCH /api/patients/:id
  ↓
Strict editable-field validation
  ↓
Normalize changed phones
  ↓
Duplicate check excluding current patient
  ↓
Validate active category if changed
  ↓
Update approved fields only
```

Normal patient editing cannot modify:

- UHID
- Patient ID
- Created/audit fields
- Status
- Archive state
- Other non-approved or unknown fields

## 5. Patient Category Integration

```text
ADMIN creates/updates category
  ↓
Database category record changes
  ↓
Reception reloads category list
  ↓
GET /api/patient-categories
  ↓
Only active categories returned to RECEPTION
  ↓
Registration form dropdown updates dynamically
```

No category names are intended to be hardcoded in the registration form.

## 6. Current Route/Feature Boundaries

### Completed Patient domain
- Registration
- Duplicate detection
- Search
- Details
- Update
- Reception UI integration
- Category management integration

### Not yet implemented
- OP Visit creation
- Today's OP workflow
- Visit history
- Billing
- Discount calculation/rules
- Payment
- Receipt
- Reports

## 7. Next Intended Flow

```text
Existing or newly registered Patient
  ↓
Create OP Visit
  ↓
Patient has one or more Visits
  ↓
Today's OP / Reception workflow
  ↓
Future Billing workflow
```

**Do not model every visit as a new patient.** The Patient is the long-lived identity record; Visits are separate operational events linked to the patient.
