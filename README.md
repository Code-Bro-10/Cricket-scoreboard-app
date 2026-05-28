# CricOverdrive - Cricket Score Card Management System

CricOverdrive is a premium, modern, responsive web application for managing cricket league teams, player rosters, schedules, and player performances (scorecards) with advanced statistics tracking.

This system is built using a **Node.js + Express** backend, a client-side Single Page Application (SPA) styled with custom **Glassmorphic Cricket CSS aesthetics**, and integrated with a **relational database** supporting both **MySQL** and **SQLite** (with zero-config SQLite selected by default).

---

## 🚀 Features

- **Team Management Module**: Full CRUD (Add, view, edit, delete) for league teams storing captain and head coach details.
- **Player Management Module**: Dynamic roster list with real-time text search, filtering by team, filtering by role, and full CRUD. Roles include batsman, bowler, all-rounder, and wicket keeper.
- **Match Scheduler Module**: Create and schedule upcoming matches or update status (Scheduled, Live, Completed).
- **Interactive Scorecards**: Detailed scorecard cards displaying batsman stats (runs, balls faced, fours, sixes, strike rate) and bowler stats (overs bowled, runs conceded, wickets taken, economy rate) for each match.
- **Statistics & Leaderboards**: Dynamic calculators showing the championship points table standing, Orange Cap leaderboard (top runs), Purple Cap leaderboard (most wickets), and team cumulative scores.
- **Visual Analytics**: Interactive charts powered by Chart.js representing standings points and run distributions.
- **Admin Authentication**: Secure editing features behind an Admin Panel lock (toggle mode using the sidebar login button).

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom responsive theme), Vanilla JavaScript ES6+, FontAwesome (Icons), Chart.js (Data visualizations).
- **Backend**: Node.js, Express.js REST APIs.
- **Databases**: MySQL (Production integration) and SQLite3 (Local development file-based fallback).

---

## 📦 Project Structure

```
ScoreBoard-App/
├── package.json               # Root monorepo orchestration configuration
├── er_diagram.md              # Database Entity Relationship diagram (Mermaid)
├── README.md                  # Documentation
├── backend/                   # Backend application
│   ├── db/
│   │   ├── connection.js      # Unified Database interface (handles MySQL/SQLite)
│   │   ├── schema.sql         # MySQL table definition DDL queries
│   │   ├── seed.sql           # Seed query insert values for testing
│   │   ├── queries.sql        # Core reports and statistics queries
│   │   └── cricket.db         # File-based SQLite database (created on start)
│   ├── .env                   # Environment variables (server port & DB details)
│   ├── package.json           # Express dependencies and running scripts
│   └── server.js              # Express backend application entry point
└── frontend/                  # Frontend application
    ├── package.json           # Frontend dev tools (Vite)
    ├── vite.config.js         # Vite configuration (API proxying to backend)
    ├── index.html             # Client-side SPA dashboard markup
    ├── css/
    │   └── style.css          # Customized glassmorphism theme styling
    └── js/
        └── app.js             # API calls, event handlers, and page rendering
```

---

## ⚙️ Setup and Installation

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed.

### 2. Installation
Open your terminal in the `ScoreBoard-App` folder and run the installation script:
```bash
npm run install:all
```
This script will install all dependencies in the root project, the backend, and the frontend directories.

### 3. Fast Run (Zero-Config SQLite Mode)
By default, the application is pre-configured to use **SQLite**. It will automatically create a database file `backend/db/cricket.db`, generate the tables, and seed them with initial cricket league data when started.

1. Start both the backend and frontend dev server concurrently:
   ```bash
   npm run dev
   ```
2. Open your web browser and navigate to the frontend local server:
   ```
   http://localhost:5173
   ```
   *(Note: The backend API runs on `http://localhost:3000` and requests are automatically proxied.)*

### 4. MySQL Server Integration Mode
If you prefer to run the application with a live **MySQL** server:

1. Create a MySQL database named `cricket_db`:
   ```sql
   CREATE DATABASE cricket_db;
   ```
2. Import the database structure and initial seed data:
   ```bash
   mysql -u your_user -p cricket_db < backend/db/schema.sql
   mysql -u your_user -p cricket_db < backend/db/seed.sql
   ```
3. Open the `.env` file in the `backend/` folder and update the settings:
   ```env
   PORT=3000
   DB_TYPE=mysql
   DB_HOST=localhost
   DB_USER=your_mysql_username
   DB_PASSWORD=your_mysql_password
   DB_NAME=cricket_db
   DB_PORT=3306
   ```
4. Run the project concurrently:
   ```bash
   npm run dev
   ```

---

## 🔐 Admin Credentials

To perform editing operations (Add, Edit, Delete teams/players/matches and input scorecards):
1. Click the **Log In** button (door icon) in the bottom-left sidebar.
2. Enter the credentials:
   - **Username**: `admin`
   - **Password**: `admin123` *(configurable in the `.env` file via `ADMIN_PASSWORD`)*
3. Click **Unlock Admin Access**. Edit tools and action buttons will now appear.
