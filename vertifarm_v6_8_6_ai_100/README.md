# 🌿 VertiFarm OS — Enterprise Indoor Farming Platform

> AI + IoT + Automation SaaS for Smart Vertical Farming Operations

---

## 🚀 One-Command Deploy

```bash
# 1. Clone / download the project
cd vertifarm

# 2. Make deploy script executable
chmod +x deploy.sh

# 3. DEPLOY (production — Docker)
./deploy.sh

# 4. Open in browser
open http://localhost
```

That's it. Everything — database, backend, frontend, nginx — starts automatically.

---

## 🖥️ Access Points

| Service         | URL                            |
|----------------|-------------------------------|
| **Dashboard**   | http://localhost               |
| **API Docs**    | http://localhost:8000/docs     |
| **API**         | http://localhost:8000/api/v1   |
| **Health**      | http://localhost/health        |

**Default credentials:**
- Email: `admin@vertifarm.io`
- Password: `Admin@123456`

---

## ⚡ Development Mode (Hot Reload)

```bash
# Requires Python 3.11+ and Node 20+
./deploy.sh dev

# Frontend: http://localhost:5173
# Backend:  http://localhost:8000
# API Docs: http://localhost:8000/docs
```

---

## 🛠️ All Deploy Commands

```bash
./deploy.sh           # Production deploy (Docker)
./deploy.sh dev       # Local development (hot reload)
./deploy.sh stop      # Stop all services
./deploy.sh reset     # Wipe data + restart fresh
./deploy.sh logs      # Tail all service logs
./deploy.sh status    # Show container status
```

---

## 📁 Project Structure

```
vertifarm/
├── deploy.sh                   # One-command deploy script
├── docker-compose.yml          # Full stack orchestration
├── .env.example                # Environment template
│
├── backend/                    # FastAPI Python backend
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini             # DB migrations config
│   ├── alembic/                # Migration scripts
│   │   └── env.py
│   └── app/
│       ├── main.py             # FastAPI app entry
│       ├── core/
│       │   ├── config.py       # Pydantic settings
│       │   └── security.py     # JWT + password utils
│       ├── models/
│       │   └── models.py       # SQLAlchemy ORM models
│       ├── schemas/
│       │   └── schemas.py      # Pydantic request/response schemas
│       ├── db/
│       │   ├── session.py      # Async DB session
│       │   └── init_db.py      # Seed data
│       └── api/v1/endpoints/
│           ├── auth.py         # Login, JWT, /me
│           └── api.py          # All platform endpoints
│
├── frontend/                   # React + TypeScript frontend
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── src/
│       ├── main.tsx            # React entry
│       ├── App.tsx             # Router + QueryClient
│       ├── styles/globals.css  # Global CSS + design tokens
│       ├── lib/
│       │   ├── api.ts          # Axios API client
│       │   └── utils.ts        # Utilities
│       ├── store/
│       │   ├── authStore.ts    # Zustand auth state
│       │   └── uiStore.ts      # UI state
│       ├── components/
│       │   ├── ui/index.tsx    # Design system components
│       │   └── layout/AppLayout.tsx  # Shell with sidebar
│       └── pages/
│           ├── Login.tsx       # Auth page
│           ├── Overview.tsx    # Main dashboard
│           ├── Zones.tsx       # Zone management + sensors
│           ├── Crops.tsx       # Crop batches + recipes
│           ├── Alerts.tsx      # Alert management
│           ├── AI.tsx          # AI Intelligence center
│           ├── Analytics.tsx   # BI dashboards
│           ├── Devices.tsx     # IoT device management
│           ├── Settings.tsx    # Platform settings
│           └── Modules.tsx     # Climate, Irrigation, Lighting,
│                               # CO2, Automation, Energy,
│                               # Inventory, SOPs
│
└── infra/
    ├── nginx/nginx.conf        # Reverse proxy config
    └── postgres/init.sql       # DB initialization
```

---

## 🔧 Backend API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | Login → get JWT tokens |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET  | `/api/v1/auth/me` | Get current user |

### Farms & Zones
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/v1/farms` | List all farms |
| POST | `/api/v1/farms` | Create farm |
| GET  | `/api/v1/farms/{id}` | Get farm |
| GET  | `/api/v1/zones?farm_id=` | List zones |
| POST | `/api/v1/zones` | Create zone |

### Sensors
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/sensors/readings` | Ingest sensor data |
| GET  | `/api/v1/sensors/summary/{zone_id}` | Latest readings per zone |
| GET  | `/api/v1/sensors/history/{zone_id}` | Historical data |
| WS   | `/api/v1/ws/sensors/{zone_id}` | Live WebSocket stream |

### Alerts, Crops, Devices, Recipes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/v1/alerts` | List alerts (filterable) |
| PATCH | `/api/v1/alerts/{id}/resolve` | Resolve alert |
| GET  | `/api/v1/crops` | List crop batches |
| GET  | `/api/v1/recipes` | List crop recipes |
| GET  | `/api/v1/devices` | List IoT devices |

### AI Intelligence
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/ai/yield-forecast` | 7-day yield prediction |
| GET | `/api/v1/ai/climate-optimize` | Climate action recommendations |
| GET | `/api/v1/ai/disease-risk` | Disease/pest risk assessment |
| GET | `/api/v1/ai/energy-optimize` | Energy optimization tips |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/dashboard/stats` | KPI summary |
| GET | `/api/v1/analytics/yield-trend` | Yield time series |
| GET | `/api/v1/analytics/water-usage` | Water efficiency data |

---

## 🧱 Technology Stack

### Backend
- **FastAPI** — async Python web framework
- **SQLAlchemy** (async) + **asyncpg** — ORM + PostgreSQL driver
- **Alembic** — database migrations
- **Pydantic v2** — validation and settings
- **python-jose** — JWT authentication
- **passlib + bcrypt** — password hashing
- **Redis** — caching and sessions
- **WebSockets** — real-time sensor streaming

### Frontend
- **React 18** + **TypeScript** — UI framework
- **React Router v6** — SPA routing
- **TanStack Query** — server state management
- **Zustand** — client state (auth, UI)
- **Axios** — HTTP client with auto token refresh
- **Recharts** — charts and data viz
- **Tailwind CSS** — utility-first styling
- **Framer Motion** — animations
- **React Hot Toast** — notifications

### Infrastructure
- **Docker Compose** — service orchestration
- **PostgreSQL 16** — primary database
- **Redis 7** — cache and pub/sub
- **Nginx** — reverse proxy + static serving

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Security (CHANGE IN PRODUCTION!)
SECRET_KEY=your_super_secret_key_here
FIRST_SUPERUSER_PASSWORD=YourSecurePassword123!

# Database
POSTGRES_PASSWORD=your_db_password

# Redis
REDIS_PASSWORD=your_redis_password
```

---

## 📊 Platform Modules

| Module | Status | Description |
|--------|--------|-------------|
| 🏠 Overview Dashboard | ✅ Complete | KPIs, zone map, alerts, AI cards |
| 🌱 Zone Management | ✅ Complete | Zone health, live sensors, history |
| 🥬 Crops & Recipes | ✅ Complete | Batch tracking, grow recipes |
| 🚨 Alert System | ✅ Complete | Multi-severity, resolve workflow |
| 🤖 AI Intelligence | ✅ Complete | Yield forecast, disease risk, copilot |
| 📊 Analytics | ✅ Complete | Yield, energy, water BI dashboards |
| 💻 Device Management | ✅ Complete | IoT registry, status, firmware |
| 🌡️ Climate Control | ✅ Complete | Zone-by-zone temp/humidity |
| 💧 Irrigation | ✅ Complete | Schedules, pH, EC, pump status |
| 💡 Lighting | ✅ Complete | LED circuits, DLI, photoperiod |
| 🌬️ CO₂ Management | ✅ Complete | Zone enrichment, tank levels |
| ⚡ Automation | ✅ Complete | IF-THEN rule engine |
| 🔋 Energy | ✅ Complete | kWh, cost, carbon, AI tips |
| 📦 Inventory | ✅ Complete | Seeds, nutrients, stock levels |
| 📋 SOPs | ✅ Complete | Procedures library |
| ⚙️ Settings | ✅ Complete | Profile, org, notifications, security |

---

## 🔒 Security

- JWT access tokens (60min) + refresh tokens (30 days)
- bcrypt password hashing
- CORS protection
- Role-based access control (superadmin → viewer)
- Auto token refresh on expiry
- Session management

---

## 📈 Scaling for Production

For production at scale, consider:

1. **Separate worker for Celery** tasks (OTA, scheduled jobs)
2. **TimescaleDB** extension for time-series sensor data at scale
3. **EMQX** MQTT broker for device connectivity
4. **Kubernetes** for multi-region deployment
5. **Object storage** (S3/MinIO) for camera images
6. **Prometheus + Grafana** for infrastructure monitoring

---

## 📄 License

MIT — Built for the global vertical farming industry.

*VertiFarm OS — Grow smarter, not harder.* 🌿
