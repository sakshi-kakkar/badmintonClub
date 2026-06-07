// ============================================================
// matches.js  —  Score update · Status · Court assignment
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
module.exports = router;

// ── GET match detail ─────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.*,
        t1.name  AS team1_name,  t1.color  AS team1_color,  t1.logo_url AS team1_logo,
        t2.name  AS team2_name,  t2.color  AS team2_color,  t2.logo_url AS team2_logo,
        wt.name  AS winner_name, c.name    AS court_name
       FROM matches m
       LEFT JOIN teams  t1 ON t1.id = m.team1_id
       LEFT JOIN teams  t2 ON t2.id = m.team2_id
       LEFT JOIN teams  wt ON wt.id = m.winner_team_id
       LEFT JOIN courts c  ON c.id  = m.court_id
       WHERE m.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Match not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// ── PUT  /matches/:id/status  (scheduled → ongoing → completed) ──
router.put('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    // Compute timestamps in JS to avoid Postgres "inconsistent types for $N" error
    const startedAt   = status === 'ongoing'   ? new Date().toISOString() : null;
    const completedAt = status === 'completed' ? new Date().toISOString() : null;
    const { rows } = await pool.query(
      `UPDATE matches
          SET status       = $1,
              started_at   = COALESCE($2::timestamptz, started_at),
              completed_at = COALESCE($3::timestamptz, completed_at)
        WHERE id = $4
        RETURNING *`,
      [status, startedAt, completedAt, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Match not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// ── PUT  /matches/:id/score  ─────────────────────────────────
// FIX: cast set_scores to jsonb explicitly; fix standings upsert params
router.put('/:id/score', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { set_scores, status, notes } = req.body;
    const matchId = req.params.id;

    // Lock the match row
    const mRes = await client.query(
      'SELECT * FROM matches WHERE id = $1 FOR UPDATE',
      [matchId]
    );
    const match = mRes.rows[0];
    if (!match) throw Object.assign(new Error('Match not found'), { status: 404 });

    // Fetch tournament for sets_per_match
    const tRes = await client.query(
      'SELECT * FROM tournaments WHERE id = $1',
      [match.tournament_id]
    );
    const tournament = tRes.rows[0];
    if (!tournament) throw Object.assign(new Error('Tournament not found'), { status: 404 });

    // ── Tally sets ───────────────────────────────────────────
    const sets       = Array.isArray(set_scores) ? set_scores : [];
    const setsToWin  = Math.ceil((tournament.sets_per_match || 3) / 2);
    let team1Sets = 0, team2Sets = 0, team1Pts = 0, team2Pts = 0;

    for (const s of sets) {
      const s1 = Number(s.t1) || 0;
      const s2 = Number(s.t2) || 0;
      team1Pts += s1;
      team2Pts += s2;
      if (s1 > s2) team1Sets++;
      else if (s2 > s1) team2Sets++;
    }

    // Determine winner
    let winner = null;
    if (team1Sets >= setsToWin) winner = match.team1_id;
    else if (team2Sets >= setsToWin) winner = match.team2_id;

    const finalStatus = winner ? 'completed' : (status || 'ongoing');
    // Compute completed_at in JS — avoids Postgres "inconsistent types for $5" error
    const completedAt  = finalStatus === 'completed' ? new Date().toISOString() : null;

    // ── Persist match ────────────────────────────────────────
    const { rows } = await client.query(
      `UPDATE matches
          SET set_scores     = $1::jsonb,
              team1_score    = $2,
              team2_score    = $3,
              winner_team_id = $4,
              status         = $5,
              notes          = $6,
              completed_at   = COALESCE($7::timestamptz, completed_at)
        WHERE id = $8
        RETURNING *`,
      [
        JSON.stringify(sets),   // $1 — cast to jsonb in SQL
        team1Sets,              // $2
        team2Sets,              // $3
        winner,                 // $4
        finalStatus,            // $5
        notes || null,          // $6
        completedAt,            // $7 — null keeps existing value via COALESCE
        matchId,                // $8
      ]
    );

    // ── Side-effects when match completes ────────────────────
    if (finalStatus === 'completed' && winner) {
      // 1. Propagate winner into the next knockout/playoff round
      await propagateWinner(client, match, winner, tournament);

      // 3. For playoff tournaments: check if all league games are done
      //    and auto-seed the playoff bracket
      if (tournament.format === 'playoff') {
        await maybeAutoSeedPlayoffs(client, match.tournament_id, tournament);
      }
    }

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

// ── PUT  /matches/:id/court ──────────────────────────────────
router.put('/:id/court', async (req, res, next) => {
  try {
    const { court_id } = req.body;
    const { rows } = await pool.query(
      'UPDATE matches SET court_id = $1 WHERE id = $2 RETURNING *',
      [court_id, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// ============================================================
// HELPER: propagateWinner
// Fills the next knockout/playoff round with the winner,
// and fills 3rd-place match with losers of semi-finals.
// For IPL format: Qualifier1 winner → Final;
//                 Qualifier1 loser  → Q2;
//                 Eliminator winner → Q2;
//                 Eliminator loser  → eliminated.
// ============================================================
async function propagateWinner(client, match, winner, tournament) {
  const roundRes = await client.query(
    'SELECT * FROM rounds WHERE id = $1',
    [match.round_id]
  );
  const round = roundRes.rows[0];
  if (!round) return;

  // League/group matches don't propagate
  if (['league', 'group_stage'].includes(round.round_type)) return;

  const loser = winner === match.team1_id ? match.team2_id : match.team1_id;

  // ── IPL-specific round routing ───────────────────────────
  if (tournament.format === 'playoff') {
    await propagateIPL(client, match, round, winner, loser, tournament.id);
    return;
  }

  // ── Standard knockout routing ────────────────────────────
  if (round.round_type === 'final') {
    // Tournament over
    await client.query(
      `UPDATE tournaments SET winner_team_id = $1, status = 'completed' WHERE id = $2`,
      [winner, match.tournament_id]
    );
    return;
  }

  if (round.round_type === 'semifinal') {
    // Winner → final, Loser → 3rd place
    await fillNextRoundSlot(client, match.tournament_id, round.round_number, winner, ['final']);
    await fill3rdPlace(client, match.tournament_id, loser);
    return;
  }

  // Generic: winner goes to next round
  await fillNextRoundSlot(client, match.tournament_id, round.round_number, winner, null);
}

// ── IPL Playoff propagation ──────────────────────────────────
// Round structure (created by generateIPLPlayoffs):
//   round_type = 'qualifier1'  (match: Rank1 vs Rank2)
//   round_type = 'eliminator'  (match: Rank3 vs Rank4)
//   round_type = 'qualifier2'  (match: Q1-loser vs Elim-winner)
//   round_type = 'final'       (match: Q1-winner vs Q2-winner)
async function propagateIPL(client, match, round, winner, loser, tournamentId) {
  if (round.round_type === 'qualifier1') {
    // Winner → Final directly
    await fillSpecificRound(client, tournamentId, 'final', winner);
    // Loser  → Qualifier 2
    await fillSpecificRound(client, tournamentId, 'qualifier2', loser);
    return;
  }

  if (round.round_type === 'eliminator') {
    // Winner → Qualifier 2
    await fillSpecificRound(client, tournamentId, 'qualifier2', winner);
    // Loser is eliminated (no action needed)
    return;
  }

  if (round.round_type === 'qualifier2') {
    // Winner → Final
    await fillSpecificRound(client, tournamentId, 'final', winner);
    // Loser eliminated
    return;
  }

  if (round.round_type === 'final') {
    await client.query(
      `UPDATE tournaments SET winner_team_id = $1, status = 'completed' WHERE id = $2`,
      [winner, tournamentId]
    );
    return;
  }
}

// Fill an empty slot in a specific round_type match
async function fillSpecificRound(client, tournamentId, roundType, teamId) {
  const res = await client.query(
    `SELECT m.id, m.team1_id, m.team2_id
       FROM matches m
       JOIN rounds  r ON r.id = m.round_id
      WHERE r.tournament_id = $1
        AND r.round_type    = $2
        AND (m.team1_id IS NULL OR m.team2_id IS NULL)
      ORDER BY m.match_number
      LIMIT 1`,
    [tournamentId, roundType]
  );
  if (!res.rows[0]) return;
  const m = res.rows[0];
  if (!m.team1_id) {
    await client.query('UPDATE matches SET team1_id = $1 WHERE id = $2', [teamId, m.id]);
  } else {
    await client.query('UPDATE matches SET team2_id = $1 WHERE id = $2', [teamId, m.id]);
  }
}

// Fill next sequential round (standard knockout)
async function fillNextRoundSlot(client, tournamentId, currentRoundNumber, teamId, allowedTypes) {
  let q = `SELECT r.id, r.round_type FROM rounds r
            WHERE r.tournament_id = $1
              AND r.round_number  > $2
              AND r.round_type   != 'third_place'`;
  if (allowedTypes && allowedTypes.length) {
    q += ` AND r.round_type IN (${allowedTypes.map((_,i)=>`$${i+3}`).join(',')})`;
  }
  q += ' ORDER BY r.round_number LIMIT 1';

  const params = [tournamentId, currentRoundNumber, ...(allowedTypes||[])];
  const rRes = await client.query(q, params);
  if (!rRes.rows[0]) return;

  const nextRoundId = rRes.rows[0].id;
  const mRes = await client.query(
    `SELECT id, team1_id, team2_id FROM matches
      WHERE round_id = $1
        AND (team1_id IS NULL OR team2_id IS NULL)
      ORDER BY match_number
      LIMIT 1`,
    [nextRoundId]
  );
  if (!mRes.rows[0]) return;
  const nm = mRes.rows[0];
  if (!nm.team1_id) {
    await client.query('UPDATE matches SET team1_id = $1 WHERE id = $2', [teamId, nm.id]);
  } else {
    await client.query('UPDATE matches SET team2_id = $1 WHERE id = $2', [teamId, nm.id]);
  }
}

// Fill 3rd place match with a loser
async function fill3rdPlace(client, tournamentId, loserId) {
  const res = await client.query(
    `SELECT m.id, m.team1_id, m.team2_id
       FROM matches m
       JOIN rounds  r ON r.id = m.round_id
      WHERE r.tournament_id = $1
        AND r.round_type    = 'third_place'
        AND (m.team1_id IS NULL OR m.team2_id IS NULL)
      LIMIT 1`,
    [tournamentId]
  );
  if (!res.rows[0]) return;
  const m = res.rows[0];
  if (!m.team1_id) {
    await client.query('UPDATE matches SET team1_id = $1 WHERE id = $2', [loserId, m.id]);
  } else {
    await client.query('UPDATE matches SET team2_id = $1 WHERE id = $2', [loserId, m.id]);
  }
}

// ============================================================
// HELPER: maybeAutoSeedPlayoffs
// Called after every completed match in a playoff tournament.
// If ALL league matches are done, auto-runs the seeding logic.
// ============================================================
async function maybeAutoSeedPlayoffs(client, tournamentId, tournament) {
  // Are there any league matches still pending/ongoing?
  const pendingRes = await client.query(
    `SELECT COUNT(*) AS cnt
       FROM matches m
       JOIN rounds  r ON r.id = m.round_id
      WHERE r.tournament_id = $1
        AND r.round_type    = 'league'
        AND m.status NOT IN ('completed', 'walkover')`,
    [tournamentId]
  );
  if (parseInt(pendingRes.rows[0].cnt) > 0) return; // still games to play

  // Are playoff matches already seeded (team1_id set in first playoff round)?
  const seededRes = await client.query(
    `SELECT COUNT(*) AS cnt
       FROM matches m
       JOIN rounds  r ON r.id = m.round_id
      WHERE r.tournament_id = $1
        AND r.round_type   IN ('qualifier1','eliminator','semifinal','quarterfinal')
        AND m.team1_id IS NOT NULL`,
    [tournamentId]
  );
  if (parseInt(seededRes.rows[0].cnt) > 0) return; // already seeded

  // Compute live standings from league matches — mirrors standings.js logic exactly
  const teamsRes = await client.query(
    `SELECT tt.team_id, tt.group_name FROM tournament_teams tt WHERE tt.tournament_id = $1`,
    [tournamentId]
  );
  const leagueMatchRes = await client.query(
    `SELECT m.team1_id, m.team2_id, m.winner_team_id, m.team1_score, m.team2_score, m.set_scores
       FROM matches m
       JOIN rounds r ON r.id = m.round_id
      WHERE r.tournament_id = $1
        AND r.round_type IN ('league', 'group_stage')
        AND m.status = 'completed'
        AND m.winner_team_id IS NOT NULL`,
    [tournamentId]
  );

  // Build standings map
  const standingsMap = {};
  for (const tt of teamsRes.rows) {
    standingsMap[tt.team_id] = { team_id: tt.team_id, group_name: tt.group_name, points: 0, sets_for: 0, sets_against: 0, points_for: 0, points_against: 0 };
  }
  for (const m of leagueMatchRes.rows) {
    const s1 = standingsMap[m.team1_id];
    const s2 = standingsMap[m.team2_id];
    if (!s1 || !s2) continue;
    let t1Sets = 0, t2Sets = 0, t1Pts = 0, t2Pts = 0;
    const sets = Array.isArray(m.set_scores) ? m.set_scores : [];
    for (const s of sets) {
      const p1 = Number(s.t1) || 0, p2 = Number(s.t2) || 0;
      t1Pts += p1; t2Pts += p2;
      if (p1 > p2) t1Sets++; else if (p2 > p1) t2Sets++;
    }
    if (!sets.length) { t1Sets = Number(m.team1_score) || 0; t2Sets = Number(m.team2_score) || 0; }
    s1.sets_for += t1Sets; s1.sets_against += t2Sets; s1.points_for += t1Pts; s1.points_against += t2Pts;
    s2.sets_for += t2Sets; s2.sets_against += t1Sets; s2.points_for += t2Pts; s2.points_against += t1Pts;
    if (m.winner_team_id === m.team1_id) { s1.points += 2; } else { s2.points += 2; }
  }

  const allTeamsSorted = Object.values(standingsMap).sort((a, b) => {
    // Rule 1: Points (2 per win)
    if (b.points !== a.points) return b.points - a.points;
    // Rule 2: Points difference (shuttle points scored minus conceded)
    const pdDiff = (b.points_for - b.points_against) - (a.points_for - a.points_against);
    if (pdDiff !== 0) return pdDiff;
    // Rule 3: Set difference (fallback)
    return (b.sets_for - b.sets_against) - (a.sets_for - a.sets_against);
  });

  const playoffTeams = tournament.playoff_teams || 4;
  // seeds[0]=Rank1, seeds[1]=Rank2, seeds[2]=Rank3, seeds[3]=Rank4
  const seeds = allTeamsSorted.slice(0, playoffTeams);

  // ── Seed IPL-style bracket ───────────────────────────────
  if (tournament.format === 'playoff') {
    await seedIPLBracket(client, tournamentId, seeds);
  } else {
    // Generic: seed first knockout round in order
    await seedGenericKnockout(client, tournamentId, seeds);
  }
}

// Seed IPL bracket:
//   Qualifier1 match : Rank1 vs Rank2
//   Eliminator match : Rank3 vs Rank4
async function seedIPLBracket(client, tournamentId, seeds) {
  if (seeds.length < 2) return;

  // Qualifier 1
  const q1 = await client.query(
    `SELECT m.id FROM matches m
       JOIN rounds r ON r.id = m.round_id
      WHERE r.tournament_id = $1 AND r.round_type = 'qualifier1'
      ORDER BY m.match_number LIMIT 1`,
    [tournamentId]
  );
  if (q1.rows[0] && seeds[0] && seeds[1]) {
    await client.query(
      'UPDATE matches SET team1_id = $1, team2_id = $2 WHERE id = $3',
      [seeds[0].team_id, seeds[1].team_id, q1.rows[0].id]
    );
  }

  // Eliminator
  const el = await client.query(
    `SELECT m.id FROM matches m
       JOIN rounds r ON r.id = m.round_id
      WHERE r.tournament_id = $1 AND r.round_type = 'eliminator'
      ORDER BY m.match_number LIMIT 1`,
    [tournamentId]
  );
  if (el.rows[0] && seeds[2] && seeds[3]) {
    await client.query(
      'UPDATE matches SET team1_id = $1, team2_id = $2 WHERE id = $3',
      [seeds[2].team_id, seeds[3].team_id, el.rows[0].id]
    );
  }
}

// Seed generic knockout first round in seeding order
async function seedGenericKnockout(client, tournamentId, seeds) {
  const roundRes = await client.query(
    `SELECT r.id FROM rounds r
      WHERE r.tournament_id = $1
        AND r.round_type NOT IN ('league','group_stage','third_place')
      ORDER BY r.round_number LIMIT 1`,
    [tournamentId]
  );
  if (!roundRes.rows[0]) return;

  const matchRes = await client.query(
    `SELECT id FROM matches WHERE round_id = $1 ORDER BY match_number`,
    [roundRes.rows[0].id]
  );

  // Pair seeds: 1v(n), 2v(n-1) …
  for (let i = 0; i < matchRes.rows.length; i++) {
    const t1 = seeds[i];
    const t2 = seeds[seeds.length - 1 - i];
    if (t1 && t2) {
      await client.query(
        'UPDATE matches SET team1_id = $1, team2_id = $2 WHERE id = $3',
        [t1.team_id, t2.team_id, matchRes.rows[i].id]
      );
    }
  }
}
