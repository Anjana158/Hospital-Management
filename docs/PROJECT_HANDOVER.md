# HMS Project Handover

## Purpose

This document is intended for another developer or AI assistant taking over the next stage of the Hospital Management System (HMS) POC.

It describes:

1. What has been implemented
2. The approach used
3. Important design decisions
4. The current code-level flow
5. What remains pending
6. What should be preserved when implementing the next modules

The project has progressed beyond the older planning documents: the Patient Management workflow and Patient Category Management are now implemented. This document should be treated as the current handover baseline.

---

# 1. Project Overview

The HMS POC is a role-based hospital operations application.

Current stack:

- React + Vite frontend
- Node.js + Express backend
- PostgreSQL database
- Prisma ORM
- JWT authentication
- REST-style backend APIs

The intended long-term operational story is:

```text
Login
  ↓
Admin / Operations
  ↓
Reception
  ↓
Patient
  ↓
Visit
  ↓
Billing
  ↓
Discount
  ↓
Payment
  ↓
Receipt
  ↓
Basic Reports
```

At the current handover point, the project has completed the foundation and the **Patient Management portion of the Reception workflow**. OP Visit and everything after it are still pending.

---

# 2. Development Approach Used So Far

The work was intentionally done incrementally rather than building the entire hospital workflow in one pass.

## Approach

### Step 1 — Preserve existing architecture
New functionality was added using the existing backend pattern:

```text
Route
  ↓
Authentication / Role Middleware
  ↓
Controller
  ↓
Service
  ↓
Prisma
  ↓
PostgreSQL
```

Frontend work follows the existing React component, dashboard, service, and nested routing patterns.

### Step 2 — Build the Patient domain before Visit
The Patient identity workflow was completed first:

1. Register patient
2. Detect likely duplicate phone records
3. Search patient
4. View patient details
5. Update approved patient fields
6. Build the Reception UI around those APIs

This means the next developer should not rebuild patient identity management while adding OP Visits.

### Step 3 — Add supporting administration when needed
Patient Categories were initially consumed by Reception. A separate Admin management UI/API workflow was then added so categories can be managed dynamically.

### Step 4 — Keep future concerns separate
Billing calculations and discount rules were deliberately not implemented inside the Patient or Category modules.

This avoids prematurely locking the database and business rules before the team agrees on the actual billing workflow.

---

# 3. Implemented Features

## 3.1 Authentication and Role-Based Access

### Status: Implemented

The application has:

- Login flow
- Credential verification
- JWT generation and usage
- Backend authentication middleware
- Role-based authorization
- Protected frontend/dashboard navigation

Core roles:

- ADMIN
- RECEPTION
- BILLING

### Important rule

Backend role middleware is the actual authorization boundary. Do not rely only on frontend route protection for security.

---

## 3.2 Admin Dashboard and User Management Foundation

### Status: Existing / active project foundation

The Admin area provides the management layer of the application and follows the existing dashboard/sidebar/nested route architecture.

Existing user-management functionality should be preserved while adding new operational modules.

---

## 3.3 Patient Registration

### Status: Completed

Implemented endpoint:

```http
POST /api/patients
```

Access:

- JWT required
- RECEPTION role required

### Registration responsibilities

The backend handles:

- Required-field validation
- Gender validation
- DOB validation
- Phone validation and normalization
- Active category validation
- Duplicate phone detection
- Server-side UHID generation
- Authenticated creator assignment

### Important decisions

#### UHID
UHIDs are generated server-side. The client cannot supply or modify them.

#### Creator
`createdBy` comes from the authenticated JWT user, not from the request body.

#### DOB
DOB is mandatory for new patient registrations.

#### Phone
Common phone formatting is accepted. The stored value is normalized to digits for consistent matching.

#### Address
The registration UI is Kerala-focused with sensible defaults and district selection.

---

## 3.4 Duplicate Phone Detection

### Status: Completed

Before registration, the submitted normalized phone is checked against existing patients' primary and alternate phone values.

Possible duplicates return:

```text
HTTP 409
PATIENT_DUPLICATE_PHONE
```

The response provides candidate patient summaries so Reception can review the possible match.

### Important design decision

Phone numbers are not globally unique.

The system does not automatically:

- Merge patients
- Overwrite an existing patient
- Assume every matching number belongs to the same person

This is intentional because shared family/contact numbers can exist.

---

## 3.5 Patient Search

### Status: Completed

Implemented endpoint:

```http
GET /api/patients/search
```

Supported search fields:

- UHID
- Name
- Phone
- Combined search

Features:

- Case-insensitive matching where appropriate
- Phone normalization
- Pagination
- Compact selection-oriented result data
- Active/inactive status visibility

The search workflow is intended to reduce duplicate registrations before creating a new patient.

---

## 3.6 Patient Details

### Status: Completed

Implemented lookups:

```http
GET /api/patients/:id
GET /api/patients/uhid/:uhid
```

Access:

- JWT required
- RECEPTION role required

The response includes the complete current patient registration profile, category, status/archive state, and timestamps.

Visit history is not part of this endpoint at the current stage.

---

## 3.7 Patient Update

### Status: Completed

Implemented endpoint:

```http
PATCH /api/patients/:id
```

The update is intentionally restricted to approved demographic/contact/category fields.

### Protected fields

Normal patient editing must not modify:

- ID
- UHID
- Creator/audit fields
- Status
- Archive state
- Other unknown fields

### Update protections

- Strict field allowlist
- Phone normalization
- Duplicate checking that excludes the current patient
- Active category validation
- Invalid/unknown fields rejected

Do not weaken these protections when adding future Visit workflows.

---

## 3.8 Reception Patient Management UI

### Status: Completed

A Reception page is wired into the Reception dashboard/navigation:

```text
/reception/patients
```

The UI supports:

- Searching patients
- Viewing search results
- Viewing patient details
- Editing approved patient information
- Opening a new registration flow
- Handling duplicate-phone responses
- Loading categories dynamically

### Current user journey

```text
Reception
  ↓
Patient Management
  ↓
Search
  ├── Existing patient → Details → Optional demographic update
  │
  └── New patient → Registration → Patient created
```

This is the completed Patient portion of Reception.

---

## 3.9 Patient Category Management

### Status: Completed

The Admin Dashboard includes Patient Category Management.

Admin capabilities:

- View categories
- Create category
- Edit category name
- Change discount eligibility flag
- Activate/deactivate categories where permitted

Backend endpoints include category listing plus ADMIN management operations.

### Category rules

- Codes are unique.
- Codes are normalized consistently.
- Codes are immutable after creation.
- Active categories are available to Reception.
- Inactive categories are hidden from Reception.
- GENERAL is the seeded standard/default category.
- GENERAL cannot be deactivated.
- No unnecessary delete workflow was added.

### Discount eligibility scope

`discountEligible` is only a category-level flag for future Billing functionality.

It does **not** currently mean:

- A percentage discount
- A fixed discount amount
- Automatic billing calculation
- A bill adjustment
- A service-level discount rule

These rules must be designed separately when Billing is implemented.

---

# 4. Current End-to-End Implemented Flow

```text
Login
  ↓
JWT Authentication
  ↓
Role Authorization
  ├── ADMIN
  │     ├── User Management
  │     └── Patient Category Management
  │
  ├── RECEPTION
  │     └── Patient Management
  │           ↓
  │         Search Patient
  │          ├── Found → View / Update
  │          └── Not Found → Register
  │
  └── BILLING
        └── Future operational workflow
```

The Reception flow currently stops after patient identity management.

The next missing operational link is:

```text
Patient
  ↓
Create OP Visit
```

---

# 5. Critical Design Principle for the Next Developer

## Patient is not Visit

A Patient is a long-lived identity/registration record.

A Visit is an operational event.

The intended relationship is:

```text
One Patient
  ├── Visit 1
  ├── Visit 2
  └── Visit 3
```

Do not:

- Create a new patient for every visit
- Store visit-specific workflow data as permanent patient identity data
- Redesign the existing Patient registration flow unnecessarily

The OP Visit module should link to an existing Patient.

---

# 6. What Is Pending

## Next priority: OP Visit Workflow

The next developer/team should agree on and implement the OP Visit model and workflow.

Questions to settle before creating the final database model:

- What is the exact Visit lifecycle/status?
- Does Reception create every Visit?
- Is a doctor selected during visit creation?
- Is department selected during visit creation?
- Can a patient have multiple visits on the same day?
- How are revisits represented?
- When does a visit become billable?
- Which Visit data should flow into Billing?

After the data model is agreed, recommended implementation order:

1. Define Visit model and relationships
2. Create OP Visit API
3. Create Reception UI for visit creation
4. Build today's OP / Reception workflow
5. Add visit history

## Later modules

- Billing
- Actual discount rules
- Payment
- Receipt
- Basic reporting
- Deployment
- Docker
- Nginx
- Ubuntu server / Hospital LAN setup

---

# 7. Important Things Not to Break

When continuing the project, preserve these existing decisions unless the team explicitly decides to redesign them:

### Architecture
- React frontend
- Node/Express backend
- PostgreSQL
- Prisma
- Route/controller/service separation

### Security
- JWT authentication
- Backend role authorization

### Roles
- ADMIN
- RECEPTION
- BILLING

### Patient identity
- Server-generated UHID
- `createdBy` derived from authenticated user
- Patient identity separate from Visit

### Duplicate handling
- Phone normalization
- Duplicate detection against primary and alternate phone
- No automatic merge
- Current patient excluded during update duplicate checks

### Patient editing
- Strict editable-field allowlist
- UHID and status are not editable through ordinary Reception demographic updates

### Categories
- Dynamic backend-driven category list
- GENERAL remains active and protected
- No hardcoded category list in Reception
- `discountEligible` is not billing logic yet

---

# 8. Suggested Workflow for Continuing Development

Before implementing the OP module, do one focused design pass:

```text
Review existing Patient model
        ↓
Agree Patient → Visit relationship
        ↓
Agree Visit fields and statuses
        ↓
Agree Reception responsibilities
        ↓
Implement backend first
        ↓
Test API flow
        ↓
Implement UI
        ↓
Test Patient → Visit workflow
```

Do not independently create overlapping Visit/Billing models in different branches without agreeing on their relationships first.

---

# 9. Recommended First Task for the Next Developer

Start with a read-only review of:

- Current Prisma Patient and PatientCategory models
- Existing patient backend module
- Existing Reception Patient Management UI
- Existing auth/role middleware
- Existing project conventions

Then propose the OP Visit data model and API contract before implementing it.

The proposal should explicitly preserve:

```text
Patient = identity record
Visit = operational event linked to Patient
```

Once the Visit contract is agreed, implementation can proceed in a focused pass.

---

# 10. Current Progress Summary

## Completed

- Authentication/JWT foundation
- Role-based access
- Admin dashboard foundation
- Patient Registration
- Duplicate phone detection
- Patient Search
- Patient Details
- Patient Update
- Reception Patient Management UI
- Mandatory DOB for new registrations
- Kerala-focused address defaults and district selection
- Patient Category Management
- Dynamic category loading in Reception
- GENERAL category protection

## Pending

- OP Visit
- Today's OP workflow
- Visit history
- Billing
- Discount calculation/rules
- Payment
- Receipt
- Reports
- Production deployment

---

## Final Note for Handover

The project should now be continued as an extension of the existing foundation, not as a rewrite.

The most important next step is to design and implement **Patient → OP Visit** cleanly. Once that boundary is stable, the later Reception and Billing workflows can build on it.
