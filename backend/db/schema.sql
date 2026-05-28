-- Cricket Score Card Management System Database Schema (MySQL Compatible)
-- Recreate Database
CREATE DATABASE IF NOT EXISTS cricket_db;
USE cricket_db;

-- 1. Teams Table
-- Normalization: 1NF, 2NF, 3NF. All columns contain atomic values, are dependent on team_id.
CREATE TABLE IF NOT EXISTS teams (
    team_id INT AUTO_INCREMENT PRIMARY KEY,
    team_name VARCHAR(100) NOT NULL UNIQUE,
    captain VARCHAR(100) NOT NULL,
    coach VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Players Table
-- Normalization: Linked to teams table via team_id foreign key. Role restricted by ENUM.
CREATE TABLE IF NOT EXISTS players (
    player_id INT AUTO_INCREMENT PRIMARY KEY,
    player_name VARCHAR(100) NOT NULL,
    age INT NOT NULL CHECK (age >= 15 AND age <= 60),
    role ENUM('batsman', 'bowler', 'all-rounder', 'wicket keeper') NOT NULL,
    team_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Matches Table
-- Normalization: Maps teams playing each other and stores details of the match.
-- winner_id is a foreign key pointing to the teams table, nullable if drawn, tied, or not yet finished.
CREATE TABLE IF NOT EXISTS matches (
    match_id INT AUTO_INCREMENT PRIMARY KEY,
    team1_id INT NOT NULL,
    team2_id INT NOT NULL,
    match_date DATE NOT NULL,
    venue VARCHAR(150) NOT NULL,
    winner_id INT DEFAULT NULL,
    status ENUM('scheduled', 'live', 'completed') DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team1_id) REFERENCES teams(team_id) ON DELETE CASCADE,
    FOREIGN KEY (team2_id) REFERENCES teams(team_id) ON DELETE CASCADE,
    FOREIGN KEY (winner_id) REFERENCES teams(team_id) ON DELETE SET NULL,
    CONSTRAINT chk_different_teams CHECK (team1_id <> team2_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Player Performances (Scorecard Details) Table
-- Normalization: Resolves many-to-many relationship between players and matches.
-- Primary key is performance_id, with a unique constraint on (match_id, player_id) to prevent duplicate cards.
CREATE TABLE IF NOT EXISTS player_performances (
    performance_id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT NOT NULL,
    player_id INT NOT NULL,
    runs_scored INT DEFAULT 0 CHECK (runs_scored >= 0),
    balls_faced INT DEFAULT 0 CHECK (balls_faced >= 0),
    fours INT DEFAULT 0 CHECK (fours >= 0),
    sixes INT DEFAULT 0 CHECK (sixes >= 0),
    wickets_taken INT DEFAULT 0 CHECK (wickets_taken >= 0),
    overs_bowled DECIMAL(3,1) DEFAULT 0.0 CHECK (overs_bowled >= 0.0 AND (overs_bowled - FLOOR(overs_bowled)) <= 0.5), -- Bowled overs (e.g. 3.5 is valid, 3.6 is not)
    runs_conceded INT DEFAULT 0 CHECK (runs_conceded >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES matches(match_id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
    UNIQUE KEY uq_match_player (match_id, player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Indexes for performance optimization
CREATE INDEX idx_player_team ON players(team_id);
CREATE INDEX idx_match_teams ON matches(team1_id, team2_id);
CREATE INDEX idx_perf_match ON player_performances(match_id);
CREATE INDEX idx_perf_player ON player_performances(player_id);
