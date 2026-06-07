// ============================================================
// standings.js  —  Always computed live from match results
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
module.exports = router;

// ── GET standings for a tournament ───────────────────────────
// Computed 100% from match results — never stale, always accurate
router.get('/tournament/:tournament_id', async (req, res, next) => {
  try {
    const tid = req.params.tournament_id;

    // 1. Get all teams in this tournament with group info
    const teamsRes = await pool.query(
      `SELECT tt.team_id, tt.group_name, tt.seeding,
              t.name AS team_name, t.color, t.logo_url
         FROM tournament_teams tt
         JOIN teams t ON t.id = tt.team_id
        WHERE tt.tournament_id = $1
        ORDER BY tt.group_name, tt.seeding`,
      [tid]
    );

    if (!teamsRes.rows.length) return res.json([]);

    // 2. Get all completed league matches
    const matchRes = await pool.query(
      `SELECT m.team1_id, m.team2_id, m.winner_team_id,
              m.team1_score, m.team2_score, m.set_scores
         FROM matches m
         JOIN rounds r ON r.id = m.round_id
        WHERE r.tournament_id = $1
          AND r.round_type IN ('league', 'group_stage')
          AND m.status = 'completed'
          AND m.winner_team_id IS NOT NULL`,
      [tid]
    );

    // 3. Build standings map — initialise every team at zero
    const map = {};
    for (const tt of teamsRes.rows) {
      map[tt.team_id] = {
        team_id:       tt.team_id,
        team_name:     tt.team_name,
        color:         tt.color,
        logo_url:      tt.logo_url,
        group_name:    tt.group_name || 'A',
        seeding:       tt.seeding,
        played:        0,
        won:           0,
        lost:          0,
        sets_for:      0,
        sets_against:  0,
        points_for:    0,
        points_against:0,
        points:        0,
      };
    }

    // 4. Accumulate from each completed match
    const h2h = {}; // h2h[winnerId][loserId] = win count

    for (const m of matchRes.rows) {
      const s1 = map[m.team1_id];
      const s2 = map[m.team2_id];
      if (!s1 || !s2) continue;

      // Count sets and points from set_scores array
      let t1Sets = 0, t2Sets = 0, t1Pts = 0, t2Pts = 0;
      // set_scores may arrive as parsed array (jsonb) or JSON string (text column)
      let rawSets = m.set_scores;
      if (typeof rawSets === 'string') { try { rawSets = JSON.parse(rawSets); } catch(_) { rawSets = []; } }
      const sets = Array.isArray(rawSets) ? rawSets : [];
      for (const s of sets) {
        const p1 = Number(s.t1) || 0;
        const p2 = Number(s.t2) || 0;
        t1Pts += p1;
        t2Pts += p2;
        if (p1 > p2) t1Sets++;
        else if (p2 > p1) t2Sets++;
      }

      // If set_scores is empty, fall back to stored set counts (shuttle points unavailable)
      if (!sets.length) {
        t1Sets = Number(m.team1_score) || 0;
        t2Sets = Number(m.team2_score) || 0;
      }

      s1.played++;  s2.played++;
      s1.sets_for      += t1Sets;  s1.sets_against   += t2Sets;
      s2.sets_for      += t2Sets;  s2.sets_against   += t1Sets;
      s1.points_for    += t1Pts;   s1.points_against += t2Pts;
      s2.points_for    += t2Pts;   s2.points_against += t1Pts;

      if (m.winner_team_id === m.team1_id) {
        s1.won++;  s2.lost++;  s1.points += 2;
      } else {
        s2.won++;  s1.lost++;  s2.points += 2;
      }

      // Track H2H
      const wid  = m.winner_team_id;
      const lid  = m.winner_team_id === m.team1_id ? m.team2_id : m.team1_id;
      if (!h2h[wid]) h2h[wid] = {};
      h2h[wid][lid] = (h2h[wid][lid] || 0) + 1;
    }

    // 5. Group teams and sort with full tiebreaker
    const byGroup = {};
    for (const s of Object.values(map)) {
      const g = s.group_name || 'A';
      if (!byGroup[g]) byGroup[g] = [];
      byGroup[g].push(s);
    }

    const result = [];
    for (const [, groupRows] of Object.entries(byGroup).sort()) {
      groupRows.sort((a, b) => {
        // Rule 1: Points (2 per win)
        if (b.points !== a.points) return b.points - a.points;

        // Rule 2: Points difference (shuttle points scored minus conceded)
        const pdA = a.points_for - a.points_against;
        const pdB = b.points_for - b.points_against;
        if (pdB !== pdA) return pdB - pdA;

        // Rule 3: Head-to-head result (who beat whom directly)
        const aWon = (h2h[a.team_id] || {})[b.team_id] || 0;
        const bWon = (h2h[b.team_id] || {})[a.team_id] || 0;
        if (aWon !== bWon) return bWon - aWon;

        // Rule 4: Set difference (final fallback)
        const sdA = a.sets_for - a.sets_against;
        const sdB = b.sets_for - b.sets_against;
        return sdB - sdA;
      });

      groupRows.forEach((r, i) => {
        r.group_rank = i + 1;
        r.set_diff   = r.sets_for   - r.sets_against;
        r.point_diff = r.points_for - r.points_against;
      });

      result.push(...groupRows);
    }

    res.json(result);
  } catch (e) { next(e); }
});
