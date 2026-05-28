const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbType = process.env.DB_TYPE || 'sqlite';
let dbInstance = null;

// Standard interface helper to normalize query output
// MySQL returns [rows, fields]
// SQLite callbacks return rows directly or metadata on 'this' context for INSERT/UPDATE
const queryInterface = {
  query: async (sql, params = []) => {
    if (dbType === 'mysql') {
      try {
        // Prepare query (convert sqlite ? to mysql ? - they are the same)
        const [result] = await dbInstance.query(sql, params);
        
        // Normalize INSERT/UPDATE response metadata
        if (result && result.constructor && result.constructor.name === 'ResultSetHeader') {
          return {
            affectedRows: result.affectedRows,
            insertId: result.insertId,
            warningStatus: result.warningStatus
          };
        }
        return result;
      } catch (err) {
        console.error('MySQL Database Error for query:', sql, err);
        throw err;
      }
    } else {
      // SQLite execution using promises
      return new Promise((resolve, reject) => {
        // Check query type
        const cleanSql = sql.trim().toUpperCase();
        const isSelect = cleanSql.startsWith('SELECT') || cleanSql.startsWith('WITH') || cleanSql.startsWith('PRAGMA');
        
        if (isSelect) {
          dbInstance.all(sql, params, (err, rows) => {
            if (err) {
              console.error('SQLite Select Error for query:', sql, err);
              return reject(err);
            }
            resolve(rows);
          });
        } else {
          dbInstance.run(sql, params, function (err) {
            if (err) {
              console.error('SQLite Run Error for query:', sql, err);
              return reject(err);
            }
            resolve({
              affectedRows: this.changes,
              insertId: this.lastID
            });
          });
        }
      });
    }
  }
};

// Initialize SQLite database schema & seed data
async function initSQLite() {
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS teams (
        team_id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_name TEXT NOT NULL UNIQUE,
        captain TEXT NOT NULL,
        coach TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS players (
        player_id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_name TEXT NOT NULL,
        age INTEGER NOT NULL CHECK (age >= 15 AND age <= 60),
        role TEXT NOT NULL CHECK (role IN ('batsman', 'bowler', 'all-rounder', 'wicket keeper')),
        team_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS matches (
        match_id INTEGER PRIMARY KEY AUTOINCREMENT,
        team1_id INTEGER NOT NULL,
        team2_id INTEGER NOT NULL,
        match_date TEXT NOT NULL,
        venue TEXT NOT NULL,
        winner_id INTEGER DEFAULT NULL,
        status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team1_id) REFERENCES teams(team_id) ON DELETE CASCADE,
        FOREIGN KEY (team2_id) REFERENCES teams(team_id) ON DELETE CASCADE,
        FOREIGN KEY (winner_id) REFERENCES teams(team_id) ON DELETE SET NULL,
        CONSTRAINT chk_different_teams CHECK (team1_id <> team2_id)
    );

    CREATE TABLE IF NOT EXISTS player_performances (
        performance_id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id INTEGER NOT NULL,
        player_id INTEGER NOT NULL,
        runs_scored INTEGER DEFAULT 0 CHECK (runs_scored >= 0),
        balls_faced INTEGER DEFAULT 0 CHECK (balls_faced >= 0),
        fours INTEGER DEFAULT 0 CHECK (fours >= 0),
        sixes INTEGER DEFAULT 0 CHECK (sixes >= 0),
        wickets_taken INTEGER DEFAULT 0 CHECK (wickets_taken >= 0),
        overs_bowled REAL DEFAULT 0.0 CHECK (overs_bowled >= 0.0),
        runs_conceded INTEGER DEFAULT 0 CHECK (runs_conceded >= 0),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (match_id) REFERENCES matches(match_id) ON DELETE CASCADE,
        FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
        UNIQUE (match_id, player_id)
    );
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Split tables and run
  const statements = schemaSql.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await queryInterface.query(stmt);
  }

  // Check if we need to seed
  const teams = await queryInterface.query('SELECT COUNT(*) as count FROM teams');
  if (teams[0].count === 0) {
    console.log('SQLite database is empty. Seeding initial data...');
    
    // Seed Teams
    await queryInterface.query(`
      INSERT INTO teams (team_id, team_name, captain, coach) VALUES
      (1, 'India', 'Rohit Sharma', 'Rahul Dravid'),
      (2, 'Australia', 'Pat Cummins', 'Andrew McDonald'),
      (3, 'England', 'Ben Stokes', 'Brendon McCullum'),
      (4, 'South Africa', 'Temba Bavuma', 'Rob Walter')
    `);

    // Seed Players
    await queryInterface.query(`
      INSERT INTO players (player_id, player_name, age, role, team_id) VALUES
      (1, 'Virat Kohli', 35, 'batsman', 1),
      (2, 'Rohit Sharma', 37, 'batsman', 1),
      (3, 'Jasprit Bumrah', 30, 'bowler', 1),
      (4, 'Ravindra Jadeja', 35, 'all-rounder', 1),
      (5, 'Rishabh Pant', 26, 'wicket keeper', 1),
      (6, 'Hardik Pandya', 30, 'all-rounder', 1),
      (7, 'Travis Head', 30, 'batsman', 2),
      (8, 'Steve Smith', 35, 'batsman', 2),
      (9, 'Pat Cummins', 31, 'bowler', 2),
      (10, 'Mitchell Starc', 34, 'bowler', 2),
      (11, 'Glenn Maxwell', 35, 'all-rounder', 2),
      (12, 'Alex Carey', 32, 'wicket keeper', 2),
      (13, 'Jos Buttler', 33, 'wicket keeper', 3),
      (14, 'Joe Root', 33, 'batsman', 3),
      (15, 'Ben Stokes', 32, 'all-rounder', 3),
      (16, 'Jofra Archer', 29, 'bowler', 3),
      (17, 'Adil Rashid', 36, 'bowler', 3),
      (18, 'Quinton de Kock', 31, 'wicket keeper', 4),
      (19, 'Heinrich Klaasen', 32, 'batsman', 4),
      (20, 'Aiden Markram', 29, 'all-rounder', 4),
      (21, 'Kagiso Rabada', 29, 'bowler', 4),
      (22, 'Anrich Nortje', 30, 'bowler', 4)
    `);

    // Seed Matches
    await queryInterface.query(`
      INSERT INTO matches (match_id, team1_id, team2_id, match_date, venue, winner_id, status) VALUES
      (1, 1, 2, '2026-05-15', 'Narendra Modi Stadium, Ahmedabad', 1, 'completed'),
      (2, 2, 3, '2026-05-18', 'Lord''s, London', 2, 'completed'),
      (3, 1, 3, '2026-05-22', 'Wankhede Stadium, Mumbai', 1, 'completed'),
      (4, 3, 4, '2026-05-25', 'The Wanderers, Johannesburg', 4, 'completed'),
      (5, 1, 4, '2026-05-28', 'Eden Gardens, Kolkata', NULL, 'live'),
      (6, 2, 4, '2026-05-30', 'Melbourne Cricket Ground, Melbourne', NULL, 'scheduled')
    `);

    // Seed Performances
    const performances = [
      // Match 1
      [1, 1, 85, 50, 8, 3, 0, 0.0, 0],
      [1, 2, 52, 34, 6, 2, 0, 0.0, 0],
      [1, 5, 28, 15, 3, 1, 0, 0.0, 0],
      [1, 4, 18, 12, 1, 0, 1, 4.0, 28],
      [1, 3, 0, 0, 0, 0, 3, 4.0, 18],
      [1, 6, 12, 8, 1, 0, 2, 3.0, 22],
      [1, 7, 72, 45, 9, 2, 0, 0.0, 0],
      [1, 8, 41, 30, 4, 0, 0, 0.0, 0],
      [1, 11, 22, 14, 2, 1, 0, 2.0, 19],
      [1, 12, 15, 10, 1, 0, 0, 0.0, 0],
      [1, 9, 8, 5, 1, 0, 1, 4.0, 35],
      [1, 10, 2, 3, 0, 0, 2, 4.0, 32],
      // Match 2
      [2, 7, 110, 62, 14, 5, 0, 0.0, 0],
      [2, 8, 32, 25, 3, 0, 0, 0.0, 0],
      [2, 11, 45, 20, 4, 3, 1, 3.0, 25],
      [2, 9, 4, 2, 0, 0, 3, 4.0, 21],
      [2, 10, 0, 0, 0, 0, 2, 4.0, 30],
      [2, 13, 58, 38, 5, 2, 0, 0.0, 0],
      [2, 14, 62, 45, 6, 1, 0, 0.0, 0],
      [2, 15, 19, 12, 2, 0, 1, 3.0, 28],
      [2, 16, 12, 8, 1, 1, 2, 4.0, 35],
      [2, 17, 5, 4, 0, 0, 1, 4.0, 27],
      // Match 3
      [3, 1, 92, 55, 10, 4, 0, 0.0, 0],
      [3, 2, 28, 18, 4, 1, 0, 0.0, 0],
      [3, 5, 40, 22, 5, 2, 0, 0.0, 0],
      [3, 4, 25, 15, 2, 1, 2, 4.0, 24],
      [3, 3, 1, 2, 0, 0, 4, 4.0, 15],
      [3, 13, 22, 15, 3, 0, 0, 0.0, 0],
      [3, 14, 48, 36, 5, 1, 0, 0.0, 0],
      [3, 15, 35, 24, 3, 2, 1, 2.0, 18],
      [3, 16, 8, 6, 1, 0, 1, 4.0, 32],
      [3, 17, 2, 3, 0, 0, 1, 4.0, 30],
      // Match 4
      [4, 13, 41, 25, 4, 2, 0, 0.0, 0],
      [4, 14, 75, 50, 8, 2, 0, 0.0, 0],
      [4, 15, 28, 18, 3, 1, 0, 3.0, 24],
      [4, 16, 5, 3, 0, 0, 2, 4.0, 28],
      [4, 18, 68, 42, 7, 3, 0, 0.0, 0],
      [4, 19, 52, 30, 5, 3, 0, 0.0, 0],
      [4, 20, 33, 20, 3, 1, 1, 2.0, 15],
      [4, 21, 12, 8, 1, 0, 3, 4.0, 22],
      [4, 22, 4, 3, 0, 0, 2, 4.0, 26]
    ];

    for (const perf of performances) {
      await queryInterface.query(`
        INSERT INTO player_performances 
        (match_id, player_id, runs_scored, balls_faced, fours, sixes, wickets_taken, overs_bowled, runs_conceded)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, perf);
    }
    console.log('SQLite database seeded successfully.');
  }
  
  // Seed admin user if it doesn't exist
  const usersCount = await queryInterface.query('SELECT COUNT(*) as count FROM users WHERE role = "admin"');
  if (usersCount[0].count === 0) {
    const bcrypt = require('bcryptjs');
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = await bcrypt.hash(adminPass, 10);
    await queryInterface.query('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', ['admin', hash, 'admin']);
    console.log('Admin user seeded.');
  }
}

// Establish DB connection based on DB_TYPE
if (dbType === 'mysql') {
  console.log('Connecting to MySQL Database...');
  const mysql = require('mysql2/promise');
  dbInstance = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cricket_db',
    port: parseInt(process.env.DB_PORT || '3306'),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
} else {
  console.log('Using SQLite Database (cricket.db)...');
  const sqlite3 = require('sqlite3').verbose();
  const dbDir = path.join(__dirname, '..', 'db');
  
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  const dbPath = path.join(dbDir, 'cricket.db');
  dbInstance = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening SQLite database:', err.message);
    } else {
      console.log('SQLite Database connected successfully at:', dbPath);
      // Initialize database tables and seed data
      initSQLite().catch(console.error);
    }
  });
}

module.exports = queryInterface;
