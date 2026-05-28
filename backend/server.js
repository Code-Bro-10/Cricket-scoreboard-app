const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db/connection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// --- AUTHENTICATION MIDDLEWARE ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    
    // Only admins can modify data
    if (req.method !== 'GET' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin privileges required' });
    }
    next();
  });
}

// ============================================
// AUTHENTICATION MODULE
// ============================================

// Signup
app.post('/api/auth/signup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
  
  try {
    const hash = await bcrypt.hash(password, 10);
    const sql = 'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)';
    // Default new signups to 'user' role
    await db.query(sql, [username, hash, 'user']);
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const users = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    
    const user = users[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Current User (Me)
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// ============================================
// TEAM MANAGEMENT MODULE
// ============================================

// Get all teams
app.get('/api/teams', async (req, res) => {
  try {
    const sql = 'SELECT * FROM teams ORDER BY team_name ASC';
    const teams = await db.query(sql);
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add team
app.post('/api/teams', authenticateToken, async (req, res) => {
  const { team_name, captain, coach } = req.body;
  if (!team_name || !captain || !coach) {
    return res.status(400).json({ error: 'All fields (team_name, captain, coach) are required.' });
  }
  try {
    const sql = 'INSERT INTO teams (team_name, captain, coach) VALUES (?, ?, ?)';
    const result = await db.query(sql, [team_name, captain, coach]);
    res.status(201).json({ team_id: result.insertId, team_name, captain, coach });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      res.status(400).json({ error: 'A team with this name already exists.' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Update team
app.put('/api/teams/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { team_name, captain, coach } = req.body;
  if (!team_name || !captain || !coach) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  try {
    const sql = 'UPDATE teams SET team_name = ?, captain = ?, coach = ? WHERE team_id = ?';
    const result = await db.query(sql, [team_name, captain, coach, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Team not found.' });
    }
    res.json({ message: 'Team updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete team
app.delete('/api/teams/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const sql = 'DELETE FROM teams WHERE team_id = ?';
    const result = await db.query(sql, [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Team not found.' });
    }
    res.json({ message: 'Team deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// PLAYER MANAGEMENT MODULE
// ============================================

// Get players (with search and filters)
app.get('/api/players', async (req, res) => {
  const { search, team_id, role } = req.query;
  try {
    let sql = `
      SELECT p.*, t.team_name 
      FROM players p 
      JOIN teams t ON p.team_id = t.team_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ' AND (p.player_name LIKE ? OR t.team_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (team_id) {
      sql += ' AND p.team_id = ?';
      params.push(team_id);
    }
    if (role) {
      sql += ' AND p.role = ?';
      params.push(role);
    }

    sql += ' ORDER BY t.team_name ASC, p.player_name ASC';
    const players = await db.query(sql, params);
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add player
app.post('/api/players', authenticateToken, async (req, res) => {
  const { player_name, age, role, team_id } = req.body;
  if (!player_name || !age || !role || !team_id) {
    return res.status(400).json({ error: 'All fields (player_name, age, role, team_id) are required.' });
  }
  if (age < 15 || age > 60) {
    return res.status(400).json({ error: 'Player age must be between 15 and 60.' });
  }
  const validRoles = ['batsman', 'bowler', 'all-rounder', 'wicket keeper'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be one of: ' + validRoles.join(', ') });
  }
  try {
    const sql = 'INSERT INTO players (player_name, age, role, team_id) VALUES (?, ?, ?, ?)';
    const result = await db.query(sql, [player_name, age, role, team_id]);
    res.status(201).json({ player_id: result.insertId, player_name, age, role, team_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update player
app.put('/api/players/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { player_name, age, role, team_id } = req.body;
  if (!player_name || !age || !role || !team_id) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  try {
    const sql = 'UPDATE players SET player_name = ?, age = ?, role = ?, team_id = ? WHERE player_id = ?';
    const result = await db.query(sql, [player_name, age, role, team_id, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Player not found.' });
    }
    res.json({ message: 'Player updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete player
app.delete('/api/players/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const sql = 'DELETE FROM players WHERE player_id = ?';
    const result = await db.query(sql, [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Player not found.' });
    }
    res.json({ message: 'Player deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// MATCH MANAGEMENT MODULE
// ============================================

// Get matches
app.get('/api/matches', async (req, res) => {
  const { status } = req.query;
  try {
    let sql = `
      SELECT m.*, 
             t1.team_name AS team1_name, 
             t2.team_name AS team2_name, 
             w.team_name AS winner_name
      FROM matches m
      JOIN teams t1 ON m.team1_id = t1.team_id
      JOIN teams t2 ON m.team2_id = t2.team_id
      LEFT JOIN teams w ON m.winner_id = w.team_id
    `;
    const params = [];
    if (status) {
      sql += ' WHERE m.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY m.match_date DESC';
    const matches = await db.query(sql, params);
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add match
app.post('/api/matches', authenticateToken, async (req, res) => {
  const { team1_id, team2_id, match_date, venue, status } = req.body;
  if (!team1_id || !team2_id || !match_date || !venue) {
    return res.status(400).json({ error: 'All fields (team1_id, team2_id, match_date, venue) are required.' });
  }
  if (parseInt(team1_id) === parseInt(team2_id)) {
    return res.status(400).json({ error: 'A team cannot play against itself.' });
  }
  try {
    const sql = 'INSERT INTO matches (team1_id, team2_id, match_date, venue, status) VALUES (?, ?, ?, ?, ?)';
    const result = await db.query(sql, [team1_id, team2_id, match_date, venue, status || 'scheduled']);
    res.status(201).json({ match_id: result.insertId, team1_id, team2_id, match_date, venue, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update match
app.put('/api/matches/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { team1_id, team2_id, match_date, venue, winner_id, status } = req.body;
  if (!team1_id || !team2_id || !match_date || !venue || !status) {
    return res.status(400).json({ error: 'All fields (team1_id, team2_id, match_date, venue, status) are required.' });
  }
  try {
    const sql = 'UPDATE matches SET team1_id = ?, team2_id = ?, match_date = ?, venue = ?, winner_id = ?, status = ? WHERE match_id = ?';
    const result = await db.query(sql, [team1_id, team2_id, match_date, venue, winner_id || null, status, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Match not found.' });
    }
    res.json({ message: 'Match updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete match
app.delete('/api/matches/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const sql = 'DELETE FROM matches WHERE match_id = ?';
    const result = await db.query(sql, [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Match not found.' });
    }
    res.json({ message: 'Match deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// SCORECARD MODULE
// ============================================

// Get scorecards (All players for both teams of the match with performance info if recorded)
app.get('/api/matches/:matchId/scorecard', async (req, res) => {
  const { matchId } = req.params;
  try {
    // 1. Fetch match metadata
    const matchSql = `
      SELECT m.*, 
             t1.team_name AS team1_name, 
             t2.team_name AS team2_name, 
             w.team_name AS winner_name
      FROM matches m
      JOIN teams t1 ON m.team1_id = t1.team_id
      JOIN teams t2 ON m.team2_id = t2.team_id
      LEFT JOIN teams w ON m.winner_id = w.team_id
      WHERE m.match_id = ?
    `;
    const match = await db.query(matchSql, [matchId]);
    if (match.length === 0) {
      return res.status(404).json({ error: 'Match not found.' });
    }

    // 2. Fetch all players of the two teams and their match performance details
    const scorecardSql = `
      SELECT 
          p.player_id, 
          p.player_name, 
          p.role, 
          p.team_id, 
          t.team_name,
          pp.performance_id,
          COALESCE(pp.runs_scored, 0) AS runs_scored,
          COALESCE(pp.balls_faced, 0) AS balls_faced,
          COALESCE(pp.fours, 0) AS fours,
          COALESCE(pp.sixes, 0) AS sixes,
          COALESCE(pp.wickets_taken, 0) AS wickets_taken,
          COALESCE(pp.overs_bowled, 0.0) AS overs_bowled,
          COALESCE(pp.runs_conceded, 0) AS runs_conceded
      FROM players p
      JOIN teams t ON p.team_id = t.team_id
      LEFT JOIN player_performances pp ON p.player_id = pp.player_id AND pp.match_id = ?
      WHERE p.team_id = ? OR p.team_id = ?
      ORDER BY t.team_name ASC, p.player_name ASC
    `;
    const scorecardRows = await db.query(scorecardSql, [matchId, match[0].team1_id, match[0].team2_id]);
    
    // Group into team1 and team2 sets
    const team1_players = scorecardRows.filter(p => p.team_id === match[0].team1_id);
    const team2_players = scorecardRows.filter(p => p.team_id === match[0].team2_id);

    res.json({
      match: match[0],
      team1: {
        team_id: match[0].team1_id,
        team_name: match[0].team1_name,
        players: team1_players
      },
      team2: {
        team_id: match[0].team2_id,
        team_name: match[0].team2_name,
        players: team2_players
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record performance (Add or update player stats)
app.post('/api/matches/:matchId/performance', authenticateToken, async (req, res) => {
  const { matchId } = req.params;
  const { player_id, runs_scored, balls_faced, fours, sixes, wickets_taken, overs_bowled, runs_conceded } = req.body;
  
  if (!player_id) {
    return res.status(400).json({ error: 'player_id is required.' });
  }

  try {
    // 1. Check if performance record already exists for this player in this match
    const checkSql = 'SELECT performance_id FROM player_performances WHERE match_id = ? AND player_id = ?';
    const existing = await db.query(checkSql, [matchId, player_id]);

    if (existing.length > 0) {
      // 2. Perform UPDATE
      const updateSql = `
        UPDATE player_performances 
        SET runs_scored = ?, balls_faced = ?, fours = ?, sixes = ?, wickets_taken = ?, overs_bowled = ?, runs_conceded = ?
        WHERE match_id = ? AND player_id = ?
      `;
      await db.query(updateSql, [
        runs_scored || 0,
        balls_faced || 0,
        fours || 0,
        sixes || 0,
        wickets_taken || 0,
        overs_bowled || 0.0,
        runs_conceded || 0,
        matchId,
        player_id
      ]);
      res.json({ message: 'Performance updated successfully.' });
    } else {
      // 3. Perform INSERT
      const insertSql = `
        INSERT INTO player_performances 
        (match_id, player_id, runs_scored, balls_faced, fours, sixes, wickets_taken, overs_bowled, runs_conceded)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const result = await db.query(insertSql, [
        matchId,
        player_id,
        runs_scored || 0,
        balls_faced || 0,
        fours || 0,
        sixes || 0,
        wickets_taken || 0,
        overs_bowled || 0.0,
        runs_conceded || 0
      ]);
      res.status(201).json({ performance_id: result.insertId, message: 'Performance recorded successfully.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// STATISTICS & REPORTS MODULE
// ============================================

// Points Table
app.get('/api/stats/points-table', async (req, res) => {
  try {
    const sql = `
      SELECT 
          t.team_id,
          t.team_name,
          COUNT(m.match_id) AS matches_played,
          SUM(CASE WHEN m.winner_id = t.team_id THEN 1 ELSE 0 END) AS wins,
          SUM(CASE WHEN m.winner_id IS NOT NULL AND m.winner_id != t.team_id THEN 1 ELSE 0 END) AS losses,
          SUM(CASE WHEN m.status = 'completed' AND m.winner_id IS NULL THEN 1 ELSE 0 END) AS ties_draws,
          SUM(CASE 
              WHEN m.winner_id = t.team_id THEN 2 
              WHEN m.status = 'completed' AND m.winner_id IS NULL THEN 1 
              ELSE 0 
          END) AS points
      FROM teams t
      LEFT JOIN matches m ON (m.team1_id = t.team_id OR m.team2_id = t.team_id) AND m.status = 'completed'
      GROUP BY t.team_id, t.team_name
      ORDER BY points DESC, wins DESC, t.team_name ASC
    `;
    const table = await db.query(sql);
    res.json(table);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Highest Run Scorer (Top Batsmen)
app.get('/api/stats/highest-runs', async (req, res) => {
  try {
    const sql = `
      SELECT 
          p.player_id,
          p.player_name,
          t.team_name,
          p.role,
          SUM(pp.runs_scored) AS total_runs,
          SUM(pp.balls_faced) AS total_balls_faced,
          CAST(SUM(pp.runs_scored) * 100.0 / NULLIF(SUM(pp.balls_faced), 0) AS DECIMAL(5,2)) AS strike_rate,
          SUM(pp.fours) AS total_fours,
          SUM(pp.sixes) AS total_sixes,
          MAX(pp.runs_scored) AS highest_score,
          COUNT(pp.match_id) AS innings_played
      FROM players p
      JOIN teams t ON p.team_id = t.team_id
      JOIN player_performances pp ON p.player_id = pp.player_id
      GROUP BY p.player_id, p.player_name, t.team_name, p.role
      ORDER BY total_runs DESC
      LIMIT 10
    `;
    const stats = await db.query(sql);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Most Wickets (Top Bowlers)
app.get('/api/stats/most-wickets', async (req, res) => {
  try {
    const sql = `
      SELECT 
          p.player_id,
          p.player_name,
          t.team_name,
          p.role,
          SUM(pp.wickets_taken) AS total_wickets,
          SUM(pp.overs_bowled) AS total_overs,
          SUM(pp.runs_conceded) AS total_runs_conceded,
          CAST(SUM(pp.runs_conceded) / NULLIF(SUM(pp.wickets_taken), 0) AS DECIMAL(5,2)) AS bowling_average,
          CAST(SUM(pp.runs_conceded) / NULLIF(SUM(pp.overs_bowled), 0) AS DECIMAL(5,2)) AS economy_rate,
          COUNT(pp.match_id) AS matches_played
      FROM players p
      JOIN teams t ON p.team_id = t.team_id
      JOIN player_performances pp ON p.player_id = pp.player_id
      WHERE p.role IN ('bowler', 'all-rounder')
      GROUP BY p.player_id, p.player_name, t.team_name, p.role
      ORDER BY total_wickets DESC, economy_rate ASC
      LIMIT 10
    `;
    const stats = await db.query(sql);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Team Total Runs (Cumulative Score across all matches)
app.get('/api/stats/team-runs', async (req, res) => {
  try {
    const sql = `
      SELECT 
          t.team_id,
          t.team_name,
          t.captain,
          COALESCE(SUM(pp.runs_scored), 0) AS cumulative_runs,
          COUNT(DISTINCT pp.match_id) AS matches_with_scores
      FROM teams t
      LEFT JOIN players p ON t.team_id = p.team_id
      LEFT JOIN player_performances pp ON p.player_id = pp.player_id
      GROUP BY t.team_id, t.team_name, t.captain
      ORDER BY cumulative_runs DESC
    `;
    const stats = await db.query(sql);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend main page for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` Cricket Score Card Management Server is Running!`);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(` Admin User: admin`);
  console.log(` Admin Password: ${ADMIN_PASSWORD}`);
  console.log(` Database: ${(process.env.DB_TYPE || 'sqlite') === 'sqlite' ? 'SQLite (Local)' : 'MySQL (Remote)'}`);
  console.log(`==================================================`);
});
