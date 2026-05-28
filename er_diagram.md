# Cricket Score Card Management System ER Diagram

The database schema is designed in **3rd Normal Form (3NF)** to avoid redundancy and maintain transactional integrity. It maps Teams, Players, Matches, and Player Performances (Scorecard).

```mermaid
erDiagram
    TEAMS {
        int team_id PK "AUTO_INCREMENT"
        varchar team_name UK "NOT NULL"
        varchar captain "NOT NULL"
        varchar coach "NOT NULL"
        timestamp created_at
    }

    PLAYERS {
        int player_id PK "AUTO_INCREMENT"
        varchar player_name "NOT NULL"
        int age "CHECK (age >= 15 AND age <= 60)"
        enum role "batsman, bowler, all-rounder, wicket keeper"
        int team_id FK "References TEAMS(team_id) ON DELETE CASCADE"
        timestamp created_at
    }

    MATCHES {
        int match_id PK "AUTO_INCREMENT"
        int team1_id FK "References TEAMS(team_id) ON DELETE CASCADE"
        int team2_id FK "References TEAMS(team_id) ON DELETE CASCADE"
        date match_date "NOT NULL"
        varchar venue "NOT NULL"
        int winner_id FK "References TEAMS(team_id) ON DELETE SET NULL"
        enum status "scheduled, live, completed"
        timestamp created_at
    }

    PLAYER_PERFORMANCES {
        int performance_id PK "AUTO_INCREMENT"
        int match_id FK "References MATCHES(match_id) ON DELETE CASCADE"
        int player_id FK "References PLAYERS(player_id) ON DELETE CASCADE"
        int runs_scored "DEFAULT 0"
        int balls_faced "DEFAULT 0"
        int fours "DEFAULT 0"
        int sixes "DEFAULT 0"
        int wickets_taken "DEFAULT 0"
        decimal overs_bowled "DEFAULT 0.0"
        int runs_conceded "DEFAULT 0"
        timestamp created_at
    }

    TEAMS ||--o{ PLAYERS : "has"
    TEAMS ||--o{ MATCHES : "plays as team1"
    TEAMS ||--o{ MATCHES : "plays as team2"
    TEAMS ||--o{ MATCHES : "wins (winner_id)"
    MATCHES ||--o{ PLAYER_PERFORMANCES : "has scorecard rows"
    PLAYERS ||--o{ PLAYER_PERFORMANCES : "scores in matches"
```

## Relationships Description
1. **TEAMS to PLAYERS (1:N)**: A team can have multiple players. Each player belongs to exactly one team. `team_id` in `PLAYERS` is a foreign key referencing `TEAMS(team_id)`.
2. **TEAMS to MATCHES (1:N)**: A team plays in multiple matches (either as `team1_id` or `team2_id`). A match can also have a `winner_id` which references the team that won (or NULL if it was a draw/tie/not yet completed).
3. **MATCHES to PLAYER_PERFORMANCES (1:N)**: A match has many player performance records (scorecard details).
4. **PLAYERS to PLAYER_PERFORMANCES (1:N)**: A player can have performance entries across different matches they played in.
5. **PLAYER_PERFORMANCES Unique Key**: The combination of `(match_id, player_id)` is defined as a `UNIQUE KEY` to ensure a player can only have one batting/bowling performance record per match.
