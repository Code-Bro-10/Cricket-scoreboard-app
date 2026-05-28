-- Cricket Score Card Management System Demonstration Queries
USE cricket_db;

-- 1. Points Table Query
-- Joins: teams and matches. Aggregates: COUNT, SUM, CASE WHEN. Group By: team_id. Order By: points DESC, wins DESC.
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
ORDER BY points DESC, wins DESC, t.team_name ASC;

-- 2. Highest Run Scorer Report (Top Batsmen)
-- Joins: players, teams, player_performances. Aggregates: SUM, MAX, COUNT. Group By: player_id. Order By: total_runs DESC.
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
LIMIT 10;

-- 3. Most Wickets Report (Top Bowlers)
-- Joins: players, teams, player_performances. Aggregates: SUM, MIN, COUNT. Group By: player_id. Order By: total_wickets DESC.
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
LIMIT 10;

-- 4. Team Total Runs (Cumulative Score across all matches)
-- Joins: teams, players, player_performances. Aggregates: SUM. Group By: team_id. Order By: cumulative_runs DESC.
SELECT 
    t.team_id,
    t.team_name,
    t.captain,
    SUM(pp.runs_scored) AS cumulative_runs,
    COUNT(DISTINCT pp.match_id) AS matches_with_scores
FROM teams t
LEFT JOIN players p ON t.team_id = p.team_id
LEFT JOIN player_performances pp ON p.player_id = pp.player_id
GROUP BY t.team_id, t.team_name, t.captain
ORDER BY cumulative_runs DESC;

-- 5. Match Result Summary (Detailed Match List)
-- Joins: matches, teams (multiple joins for team1, team2, winner). Order By: match_date DESC.
SELECT 
    m.match_id,
    t1.team_name AS team_1,
    t2.team_name AS team_2,
    m.match_date,
    m.venue,
    m.status,
    CASE 
        WHEN m.status = 'scheduled' THEN 'To Be Played'
        WHEN m.status = 'live' THEN 'Live'
        WHEN m.winner_id IS NULL THEN 'Tie / Draw'
        ELSE CONCAT(w.team_name, ' won')
    END AS result
FROM matches m
JOIN teams t1 ON m.team1_id = t1.team_id
JOIN teams t2 ON m.team2_id = t2.team_id
LEFT JOIN teams w ON m.winner_id = w.team_id
ORDER BY m.match_date DESC;
