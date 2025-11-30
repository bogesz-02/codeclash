# Card Game Project

A multiplayer card-based programming game built with React, Node.js, Socket.IO, and MySQL.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Development](#development)
- [Docker Setup](#docker-setup)
- [Testing](#testing)
- [Project Structure](#project-structure)

## ✨ Features

- Real-time multiplayer gameplay with Socket.IO
- Visual programming with drag-and-drop card interface
- Lobby system for creating and joining games
- MySQL database for persistent data
- Docker support for easy deployment and presentations

## 🛠 Tech Stack

**Frontend:**

- React 19
- Vite
- Tailwind CSS
- React DnD (drag and drop)
- Socket.IO Client

**Backend:**

- Node.js with Express
- Socket.IO
- MySQL 8.0
- Vitest (testing)

## 🚀 Quick Start

### Prerequisites

- [Node.js 20+](https://nodejs.org/) (for local development)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for containerized setup)
- Git

### Option 1: Docker (Recommended)

```powershell

# Run setup script (creates .env file)
.\scripts\setup-env.ps1

# Start all services with Docker
docker compose up --build
```

**Access the application:**

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### Option 2: Local Development (Fastest for Quick Edits)

```powershell
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Start backend (in one terminal)
cd backend
npm run dev

# Start frontend (in another terminal)
cd frontend
npm run dev
```

## 💻 Development

### Local Development Workflow

1. **Run locally** for fast iteration:
2. **Run tests** to verify changes:

### Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

```env
PORT=3001
DB_HOST=localhost           # Use 'db' for Docker, 'localhost' for local
DB_PORT=3306
DB_NAME=game_db
DB_USER=game_user
DB_PASS=*password*
CORS_ORIGIN=http://localhost:5173
```

**Important:** Never commit `backend/.env` - it's in `.gitignore` for security.

## 🐳 Docker Commands

### Starting and Stopping

```powershell
# Start all services
docker compose up --build

# Run in background
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f
docker compose logs -f backend    # Specific service
```

**Access:**

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

### Database Management

```powershell
# Reset database (WARNING: deletes all data)
docker compose down -v
docker compose up --build

# Access MySQL shell
docker compose exec db mysql -u game_user -p

# View database logs
docker compose logs db
```

## 🧪 Testing

### Run Tests Locally

```powershell
cd backend
npm test                    # Run all tests once
npm run test:watch          # Run tests in watch mode
npm run test:coverage       # Run with coverage report
```

### Run Tests in Docker

```powershell
# Run tests in a container
docker compose run --rm backend npm test

# Or if containers are running
docker compose exec backend npm test
```

**Test Results:**

- All backend tests passing: 58 tests
- Tests cover execution logic, game mechanics, and integration scenarios

## 📁 Project Structure

```
szakdoga/
├── backend/                 # Node.js backend
│   ├── src/
│   │   ├── server.js       # Express + Socket.IO server
│   │   ├── config/         # Server configuration
│   │   ├── services/       # Business logic (game, lobby, execution)
│   │   ├── sockets/        # Socket.IO handlers
│   │   └── db/             # MySQL connection
│   ├── tests/              # Vitest integration tests
│   ├── Dockerfile          # Backend production image
│   └── .env.example        # Environment template
├── frontend/               # React frontend
│   ├── src/
│   │   ├── App.jsx         # Main app component
│   │   ├── pages/          # Game and Home pages
│   │   ├── components/     # Lobby and game UI components
│   │   └── context/        # Socket and Lobby context
│   ├── Dockerfile          # Frontend production image (Nginx)
│   └── vite.config.js      # Vite configuration
├── database/
│   └── init.sql            # MySQL initialization script
├── scripts/
│   └── setup-env.ps1       # Environment setup helper
├── docker-compose.yml      # Docker setup
└── README.md               # This file
```

## 🔧 Common Issues & Solutions

### Database Connection Failed

- Ensure `.env` file exists with correct credentials
- For Docker: use `DB_HOST=db`
- For local: use `DB_HOST=localhost` and ensure MySQL is running
- Wait 10-30 seconds for DB to initialize on first Docker start

### Docker Build Fails

```powershell
# Clean Docker cache and rebuild
docker compose down -v
docker system prune -a
docker compose up --build
```

### File Changes Not Reflected (Docker)

If using `docker-compose.yml` (dev mode) and changes don't appear:

- Verify bind mounts are configured correctly
- Restart the service: `docker compose restart backend`
- Check logs: `docker compose logs -f backend`
