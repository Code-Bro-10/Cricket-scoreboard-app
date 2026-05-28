-- Cricket Score Card Management System Sample Data Seed Script
USE cricket_db;

-- Clear existing data (in reverse order of foreign keys)
DELETE FROM player_performances;
DELETE FROM matches;
DELETE FROM players;
DELETE FROM teams;

-- 1. Insert Teams
INSERT INTO teams (team_id, team_name, captain, coach) VALUES
(1, 'India', 'Rohit Sharma', 'Rahul Dravid'),
(2, 'Australia', 'Pat Cummins', 'Andrew McDonald'),
(3, 'England', 'Ben Stokes', 'Brendon McCullum'),
(4, 'South Africa', 'Temba Bavuma', 'Rob Walter');

-- Reset Auto-Increment just in case
ALTER TABLE teams AUTO_INCREMENT = 5;

-- 2. Insert Players
-- India (team_id = 1)
INSERT INTO players (player_id, player_name, age, role, team_id) VALUES
(1, 'Virat Kohli', 35, 'batsman', 1),
(2, 'Rohit Sharma', 37, 'batsman', 1),
(3, 'Jasprit Bumrah', 30, 'bowler', 1),
(4, 'Ravindra Jadeja', 35, 'all-rounder', 1),
(5, 'Rishabh Pant', 26, 'wicket keeper', 1),
(6, 'Hardik Pandya', 30, 'all-rounder', 1);

-- Australia (team_id = 2)
INSERT INTO players (player_id, player_name, age, role, team_id) VALUES
(7, 'Travis Head', 30, 'batsman', 2),
(8, 'Steve Smith', 35, 'batsman', 2),
(9, 'Pat Cummins', 31, 'bowler', 2),
(10, 'Mitchell Starc', 34, 'bowler', 2),
(11, 'Glenn Maxwell', 35, 'all-rounder', 2),
(12, 'Alex Carey', 32, 'wicket keeper', 2);

-- England (team_id = 3)
INSERT INTO players (player_id, player_name, age, role, team_id) VALUES
(13, 'Jos Buttler', 33, 'wicket keeper', 3),
(14, 'Joe Root', 33, 'batsman', 3),
(15, 'Ben Stokes', 32, 'all-rounder', 3),
(16, 'Jofra Archer', 29, 'bowler', 3),
(17, 'Adil Rashid', 36, 'bowler', 3);

-- South Africa (team_id = 4)
INSERT INTO players (player_id, player_name, age, role, team_id) VALUES
(18, 'Quinton de Kock', 31, 'wicket keeper', 4),
(19, 'Heinrich Klaasen', 32, 'batsman', 4),
(20, 'Aiden Markram', 29, 'all-rounder', 4),
(21, 'Kagiso Rabada', 29, 'bowler', 4),
(22, 'Anrich Nortje', 30, 'bowler', 4);

ALTER TABLE players AUTO_INCREMENT = 23;

-- 3. Insert Matches
INSERT INTO matches (match_id, team1_id, team2_id, match_date, venue, winner_id, status) VALUES
(1, 1, 2, '2026-05-15', 'Narendra Modi Stadium, Ahmedabad', 1, 'completed'),
(2, 2, 3, '2026-05-18', 'Lord\'s, London', 2, 'completed'),
(3, 1, 3, '2026-05-22', 'Wankhede Stadium, Mumbai', 1, 'completed'),
(4, 3, 4, '2026-05-25', 'The Wanderers, Johannesburg', 4, 'completed'),
(5, 1, 4, '2026-05-28', 'Eden Gardens, Kolkata', NULL, 'live'),
(6, 2, 4, '2026-05-30', 'Melbourne Cricket Ground, Melbourne', NULL, 'scheduled');

ALTER TABLE matches AUTO_INCREMENT = 7;

-- 4. Insert Player Performances (Scorecard Details)
-- Match 1: India vs Australia (Winner: India)
-- India Batting & Bowling
INSERT INTO player_performances (match_id, player_id, runs_scored, balls_faced, fours, sixes, wickets_taken, overs_bowled, runs_conceded) VALUES
(1, 1, 85, 50, 8, 3, 0, 0.0, 0),    -- Virat Kohli
(1, 2, 52, 34, 6, 2, 0, 0.0, 0),    -- Rohit Sharma
(1, 5, 28, 15, 3, 1, 0, 0.0, 0),    -- Rishabh Pant
(1, 4, 18, 12, 1, 0, 1, 4.0, 28),   -- Ravindra Jadeja
(1, 3, 0, 0, 0, 0, 3, 4.0, 18),     -- Jasprit Bumrah
(1, 6, 12, 8, 1, 0, 2, 3.0, 22),     -- Hardik Pandya
-- Australia Batting & Bowling
(1, 7, 72, 45, 9, 2, 0, 0.0, 0),    -- Travis Head
(1, 8, 41, 30, 4, 0, 0, 0.0, 0),    -- Steve Smith
(1, 11, 22, 14, 2, 1, 0, 2.0, 19),   -- Glenn Maxwell
(1, 12, 15, 10, 1, 0, 0, 0.0, 0),    -- Alex Carey
(1, 9, 8, 5, 1, 0, 1, 4.0, 35),     -- Pat Cummins
(1, 10, 2, 3, 0, 0, 2, 4.0, 32);    -- Mitchell Starc

-- Match 2: Australia vs England (Winner: Australia)
INSERT INTO player_performances (match_id, player_id, runs_scored, balls_faced, fours, sixes, wickets_taken, overs_bowled, runs_conceded) VALUES
-- Australia Batting & Bowling
(2, 7, 110, 62, 14, 5, 0, 0.0, 0),  -- Travis Head (Century)
(2, 8, 32, 25, 3, 0, 0, 0.0, 0),    -- Steve Smith
(2, 11, 45, 20, 4, 3, 1, 3.0, 25),   -- Glenn Maxwell
(2, 9, 4, 2, 0, 0, 3, 4.0, 21),     -- Pat Cummins
(2, 10, 0, 0, 0, 0, 2, 4.0, 30),    -- Mitchell Starc
-- England Batting & Bowling
(2, 13, 58, 38, 5, 2, 0, 0.0, 0),   -- Jos Buttler
(2, 14, 62, 45, 6, 1, 0, 0.0, 0),   -- Joe Root
(2, 15, 19, 12, 2, 0, 1, 3.0, 28),   -- Ben Stokes
(2, 16, 12, 8, 1, 1, 2, 4.0, 35),    -- Jofra Archer
(2, 17, 5, 4, 0, 0, 1, 4.0, 27);    -- Adil Rashid

-- Match 3: India vs England (Winner: India)
INSERT INTO player_performances (match_id, player_id, runs_scored, balls_faced, fours, sixes, wickets_taken, overs_bowled, runs_conceded) VALUES
-- India
(3, 1, 92, 55, 10, 4, 0, 0.0, 0),   -- Virat Kohli
(3, 2, 28, 18, 4, 1, 0, 0.0, 0),    -- Rohit Sharma
(3, 5, 40, 22, 5, 2, 0, 0.0, 0),    -- Rishabh Pant
(3, 4, 25, 15, 2, 1, 2, 4.0, 24),   -- Ravindra Jadeja
(3, 3, 1, 2, 0, 0, 4, 4.0, 15),     -- Jasprit Bumrah
-- England
(3, 13, 22, 15, 3, 0, 0, 0.0, 0),   -- Jos Buttler
(3, 14, 48, 36, 5, 1, 0, 0.0, 0),   -- Joe Root
(3, 15, 35, 24, 3, 2, 1, 2.0, 18),   -- Ben Stokes
(3, 16, 8, 6, 1, 0, 1, 4.0, 32),    -- Jofra Archer
(3, 17, 2, 3, 0, 0, 1, 4.0, 30);    -- Adil Rashid

-- Match 4: England vs South Africa (Winner: South Africa)
INSERT INTO player_performances (match_id, player_id, runs_scored, balls_faced, fours, sixes, wickets_taken, overs_bowled, runs_conceded) VALUES
-- England
(4, 13, 41, 25, 4, 2, 0, 0.0, 0),   -- Jos Buttler
(4, 14, 75, 50, 8, 2, 0, 0.0, 0),   -- Joe Root
(4, 15, 28, 18, 3, 1, 0, 3.0, 24),   -- Ben Stokes
(4, 16, 5, 3, 0, 0, 2, 4.0, 28),    -- Jofra Archer
-- South Africa
(4, 18, 68, 42, 7, 3, 0, 0.0, 0),   -- Quinton de Kock
(4, 19, 52, 30, 5, 3, 0, 0.0, 0),   -- Heinrich Klaasen
(4, 20, 33, 20, 3, 1, 1, 2.0, 15),   -- Aiden Markram
(4, 21, 12, 8, 1, 0, 3, 4.0, 22),    -- Kagiso Rabada
(4, 22, 4, 3, 0, 0, 2, 4.0, 26);    -- Anrich Nortje
