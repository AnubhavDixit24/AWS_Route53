# AWS Route 53 Clone

A functional clone of the AWS Route 53 console, focused on recreating the core Route 53 user experience — Hosted Zones and DNS Records management — with a real backend, persistent storage, and mocked authentication.

> This is an educational clone built for assignment purposes. It reproduces the Route 53 **UI/UX and CRUD workflows**, not actual DNS resolution. It is not affiliated with or endorsed by Amazon Web Services.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [Demo Credentials](#demo-credentials)
- [Architecture Overview](#architecture-overview)
- [Database Schema](#database-schema)
- [API Overview](#api-overview)
- [Bonus Features](#bonus-features)
- [Known Limitations](#known-limitations)

---

## Features

### Core (required scope)
- **Mocked authentication** — login, logout, and session persistence via HTTP-only session cookies
- **Hosted Zones** — full CRUD: view, search, create, edit, delete
- **DNS Records** — full CRUD within a hosted zone, supporting A, AAAA, CNAME, TXT, MX, NS, PTR, SRV, and CAA record types
- **Route 53–style UX** — navy top bar, left sidebar navigation, data tables, modals, toast notifications, search, filters, and pagination modeled closely on the real AWS console
- **Mocked placeholder sections** — Dashboard, Traffic Policies, Health Checks, Resolver, and Profiles, each rendered as a realistic "Coming soon" screen

### Bonus
- **Dark mode** — full theme toggle, persisted across sessions
- **Export hosted zone as JSON** — one-click download of a zone and all its records
- **Export hosted zone as BIND zone file** — standards-compliant `.zone` file download
- **Import DNS records from a BIND zone file** — upload and bulk-create records, with a preview step before committing
- **Keyboard shortcuts** — `/` to focus search, `n` to create, `Esc` to close dialogs, `?` to show the shortcuts help panel
- **Bulk operations** — multi-select hosted zones for one-click bulk delete

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (TypeScript, Pages Router) |
| Backend | FastAPI (Python) |
| Database | SQLite (via SQLAlchemy ORM) |
| Auth | Mocked session-cookie authentication (no third-party IAM) |

---

## Project Structure

```
route53-clone/
├── backend/
│   ├── requirements.txt
│   ├── route53.db                  # generated on first run
│   └── app/
│       ├── main.py                 # FastAPI app entrypoint, CORS, router mounting
│       ├── database.py             # SQLAlchemy engine/session setup
│       ├── models.py               # ORM models: User, Session, HostedZone, Record
│       ├── schemas.py              # Pydantic request/response schemas
│       ├── auth.py                 # Mock auth helpers + session dependency
│       ├── seed.py                 # First-run demo data seeding
│       └── routers/
│           ├── auth.py             # /api/auth/*
│           ├── zones.py            # /api/hosted-zones/*
│           └── records.py          # /api/hosted-zones/{id}/records/*, /api/records/*
│
└── frontend/
    ├── lib/
    │   └── api.ts                  # Typed API client
    ├── context/
    │   ├── AuthContext.tsx         # Login/session state
    │   ├── ThemeContext.tsx        # Dark/light mode
    │   └── ShortcutsContext.tsx    # Keyboard shortcuts
    ├── components/
    │   ├── AppShell.tsx            # Top bar + sidebar layout
    │   ├── Modal.tsx
    │   ├── Toast.tsx
    │   ├── Pagination.tsx
    │   ├── SearchBar.tsx
    │   └── ComingSoon.tsx
    ├── pages/
    │   ├── _app.tsx
    │   ├── login.tsx
    │   ├── index.tsx               # Dashboard
    │   ├── hosted-zones/
    │   │   ├── index.tsx           # Zones list
    │   │   └── [id].tsx            # Zone detail — Records CRUD, import/export
    │   ├── traffic-policies.tsx
    │   ├── health-checks.tsx
    │   ├── resolver.tsx
    │   └── profiles.tsx
    └── styles/
        └── globals.css             # AWS Cloudscape-inspired theme (light + dark)
```

---

## Setup Instructions

### Prerequisites
- **Python 3.11** (Python 3.14 is not recommended — some dependencies lack prebuilt wheels for it on Windows)
- **Node.js 18+** and npm
- Windows, macOS, or Linux

### 1. Backend setup

```bash
cd backend
python -m venv venv
```

Activate the virtual environment:
```bash
# Windows PowerShell
.\venv\Scripts\Activate.ps1

# macOS / Linux
source venv/bin/activate
```

Install dependencies and run the server:
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The backend will be available at **http://localhost:8000**, with interactive API docs at **http://localhost:8000/docs**.

On first run, the app automatically creates `route53.db` (SQLite) and seeds it with a demo user and two example hosted zones.

### 2. Frontend setup

In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```

The app will be available at **http://localhost:3000**.

> **Important:** the frontend must reach the backend at `http://localhost:8000` (not `127.0.0.1:8000`) — the session cookie's `SameSite` policy requires both frontend and backend to be addressed via the same hostname (`localhost`) for the browser to send it correctly.

### 3. Log in

Open **http://localhost:3000** and sign in with the demo credentials below.

---

## Demo Credentials

| Username | Password |
|---|---|
| `admin` | `admin123` |

---

## Architecture Overview

**Request flow:**
```
Browser (Next.js, localhost:3000)
      │  fetch() with credentials: "include"
      ▼
FastAPI backend (localhost:8000)
      │  session cookie validated via get_current_user dependency
      ▼
SQLAlchemy ORM
      │
      ▼
SQLite (route53.db)
```

**Authentication:** Login issues a random session token, stored server-side in a `sessions` table and set client-side as an HTTP-only cookie (`r53_session`). Every protected API route depends on `get_current_user`, which looks up the cookie's token against the `sessions` table. Logout deletes the session row and clears the cookie. On every page load, the frontend calls `GET /api/auth/me`; if the cookie is still valid, the user's session is restored automatically — this is what provides session persistence across refreshes.

**Frontend state management:** React Context is used for three concerns — `AuthContext` (current user + login/logout), `ThemeContext` (light/dark mode, persisted to `localStorage`), and `ShortcutsContext` (global keyboard shortcut registration, so any page can register its own "create" and "search focus" actions).

**Styling:** a hand-built CSS theme (no framework) using CSS custom properties to closely match AWS Cloudscape's visual language — navy (`#232f3e`) top bar, orange (`#ec7211`) primary actions, light gray content background, and the same table/modal/toast interaction patterns used throughout the real console. Dark mode overrides the same custom properties rather than duplicating styles.

**Data conventions:** IDs are AWS-style prefixed strings (e.g. `zone-a1b2c3d4e5f6`, `rrset-9f8e7d6c5b4a`) rather than plain integers, for visual authenticity with the real console. A DNS record's multiple values (e.g. multiple A records under one name) are stored as a single newline-delimited text column in SQLite and converted to/from a `string[]` at the API boundary.

---

## Database Schema

### `users`
| Column | Type | Notes |
|---|---|---|
| id | string (PK) | `usr-xxxxxxxxxxxx` |
| username | string, unique | |
| password | string | plaintext — mock auth only, **not for production use** |
| full_name | string | |
| account_id | string | mock AWS-style account ID |
| created_at | datetime | |

### `sessions`
| Column | Type | Notes |
|---|---|---|
| token | string (PK) | random hex, stored as the session cookie value |
| user_id | string (FK → users.id) | |
| created_at | datetime | |

### `hosted_zones`
| Column | Type | Notes |
|---|---|---|
| id | string (PK) | `zone-xxxxxxxxxxxx` |
| name | string, indexed | e.g. `example.com` |
| comment | text | optional description |
| private_zone | boolean | |
| zone_type | string | `Public` or `Private` |
| created_at | datetime | |
| updated_at | datetime | |

### `records`
| Column | Type | Notes |
|---|---|---|
| id | string (PK) | `rrset-xxxxxxxxxxxx` |
| hosted_zone_id | string (FK → hosted_zones.id, indexed) | cascades on zone delete |
| name | string, indexed | record name (e.g. `www.example.com`) |
| record_type | string, indexed | A, AAAA, CNAME, TXT, MX, NS, PTR, SRV, CAA, SOA |
| ttl | integer | seconds |
| routing_policy | string | Simple, Weighted, Latency, Failover, Geolocation, Multivalue |
| values | text | newline-delimited list of values |
| created_at | datetime | |
| updated_at | datetime | |

**Relationships:** `HostedZone 1 ── * Record`, with `cascade="all, delete-orphan"` — deleting a hosted zone deletes all of its records automatically. `User 1 ── * Session` similarly cascades on user deletion.

---

## API Overview

Base URL: `http://localhost:8000`

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Authenticate, set session cookie |
| POST | `/api/auth/logout` | Invalidate session, clear cookie |
| GET | `/api/auth/me` | Return current user (session persistence check) |

### Hosted Zones
| Method | Path | Description |
|---|---|---|
| GET | `/api/hosted-zones` | List zones — supports `?search=&page=&page_size=` |
| POST | `/api/hosted-zones` | Create a zone (auto-seeds NS + SOA records) |
| GET | `/api/hosted-zones/{id}` | Get one zone |
| PUT | `/api/hosted-zones/{id}` | Update a zone's description |
| DELETE | `/api/hosted-zones/{id}` | Delete a zone (cascades to records) |
| POST | `/api/hosted-zones/bulk-delete` | Delete multiple zones by ID list |
| GET | `/api/hosted-zones/{id}/export?format=json\|bind` | Download zone + records as JSON or BIND zone file |
| POST | `/api/hosted-zones/{id}/import` | Bulk-create records from an uploaded BIND zone file |

### Records
| Method | Path | Description |
|---|---|---|
| GET | `/api/hosted-zones/{zoneId}/records` | List records in a zone — supports `?search=&record_type=&page=&page_size=` |
| POST | `/api/hosted-zones/{zoneId}/records` | Create a record |
| GET | `/api/records/{id}` | Get one record |
| PUT | `/api/records/{id}` | Update TTL, routing policy, or values |
| DELETE | `/api/records/{id}` | Delete a record |

All routes except `/api/auth/login` require a valid session cookie; unauthenticated requests return `401 Unauthorized`.

Full interactive documentation (request/response schemas, try-it-out) is available at **`/docs`** while the backend is running.

---

## Bonus Features

### Dark Mode
A theme toggle (🌙/☀️) in the top bar switches the entire app between light and dark themes using CSS custom property overrides. The choice is saved to `localStorage` and restored on next visit. Note: this is a clone-specific enhancement — the real Route 53 console does not have a per-service dark mode toggle; AWS's console theme is set globally at the account level, not within individual services.

### Export as JSON
On the zone detail page, **Export → JSON** downloads a structured JSON file containing the zone's metadata and all of its record sets.

### Export as BIND zone file
**Export → BIND format** downloads a standards-formatted `.zone` file (`$ORIGIN`, `$TTL` directives, and `name  ttl  IN  type  value` rows) compatible with real DNS server zone file conventions.

### Import from BIND zone file
On the zone detail page, **Import** accepts a `.txt`/`.zone` file, parses each resource record line (skipping comments and directives), shows a preview table of what will be created, and bulk-inserts the records on confirmation.

### Keyboard Shortcuts
| Key | Action |
|---|---|
| `/` | Focus the search box |
| `n` | Open the "Create" dialog |
| `Esc` | Close the currently open modal |
| `?` | Toggle the shortcuts help panel |

Shortcuts are suppressed while typing in an input/textarea (except `Esc`, which always closes modals).

### Bulk Operations
The Hosted Zones list supports selecting multiple zones via checkboxes and deleting them all in a single confirmed action, backed by a dedicated `POST /api/hosted-zones/bulk-delete` endpoint (one DB transaction rather than N sequential requests).

---

## Known Limitations

- Authentication is intentionally mocked: passwords are stored in plaintext and there is a single hardcoded demo user. **Do not reuse this auth approach in a production system.**
- No real DNS resolution occurs — records are stored and displayed but do not affect actual domain routing.
- Routing policies (Weighted, Latency, Failover, Geolocation, Multivalue) are stored and displayed but do not simulate real traffic distribution logic.
- IAM, AWS Accounts, Organizations, and Billing are not implemented, per assignment scope — the top bar's account/region info is static mock data.
