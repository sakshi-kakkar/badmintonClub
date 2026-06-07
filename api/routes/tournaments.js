// ============================================================
// tournaments.js  —  CRUD + Fixture generation + Playoff seeding
// ============================================================
const express        = require('express');
const router         = express.Router();
const pool           = require('../db/pool');
const { v4: uuidv4 } = require('uuid');
module.exports = router;

// ── GET all tournaments ──────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, wt.name AS winner_name,
         (SELECT COUNT(*) FROM tournament_teams WHERE tournament_id = t.id)::int AS team_count,
         (SELECT COUNT(*) FROM matches         WHERE tournament_id = t.id)::int AS match_count,
         (SELECT COUNT(*) FROM matches         WHERE tournament_id = t.id AND status = 'completed')::int AS completed_matches
       FROM tournaments t
       LEFT JOIN teams wt ON wt.id = t.winner_team_id
       ORDER BY t.created_at DESC`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// ── GET single tournament with full detail ───────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const tid = req.params.id;

    const [tRes, teamsRes, roundsRes] = await Promise.all([
      pool.query(
        `SELECT t.*, wt.name AS winner_name
           FROM tournaments t
           LEFT JOIN teams wt ON wt.id = t.winner_team_id
          WHERE t.id = $1`,
        [tid]
      ),
      pool.query(
        `SELECT tt.*, tm.name, tm.color, tm.logo_url,
           COALESCE(
             json_agg(
               json_build_object(
                 'id',p.id,'name',p.name,'photo_url',p.photo_url,'role',tmem.role
               )
             ) FILTER (WHERE p.id IS NOT NULL),
             '[]'
           ) AS members
           FROM tournament_teams tt
           JOIN teams tm ON tm.id = tt.team_id
           LEFT JOIN team_members tmem ON tmem.team_id = tt.team_id
           LEFT JOIN players p ON p.id = tmem.player_id AND p.active = true
          WHERE tt.tournament_id = $1
          GROUP BY tt.id, tm.id
          ORDER BY tt.group_name, tt.seeding`,
        [tid]
      ),
      pool.query(
        `SELECT r.*,
           COALESCE(
             json_agg(
               json_build_object(
                 'id',            m.id,
                 'match_number',  m.match_number,
                 'team1_id',      m.team1_id,
                 'team1_name',    t1.name,
                 'team1_color',   t1.color,
                 'team2_id',      m.team2_id,
                 'team2_name',    t2.name,
                 'team2_color',   t2.color,
                 'team1_score',   m.team1_score,
                 'team2_score',   m.team2_score,
                 'set_scores',    m.set_scores,
                 'status',        m.status,
                 'winner_team_id',m.winner_team_id,
                 'court_id',      m.court_id,
                 'court_name',    c.name,
                 'scheduled_at',  m.scheduled_at,
                 'started_at',    m.started_at,
                 'completed_at',  m.completed_at,
                 'notes',         m.notes,
                 'leg_number',    m.leg_number,
                 'is_home_leg',   m.is_home_leg
               ) ORDER BY m.match_number
             ) FILTER (WHERE m.id IS NOT NULL),
             '[]'
           ) AS matches
           FROM rounds r
           LEFT JOIN matches m  ON m.round_id  = r.id
           LEFT JOIN teams   t1 ON t1.id       = m.team1_id
           LEFT JOIN teams   t2 ON t2.id       = m.team2_id
           LEFT JOIN courts  c  ON c.id        = m.court_id
          WHERE r.tournament_id = $1
          GROUP BY r.id
          ORDER BY r.round_number`,
        [tid]
      ),
    ]);

    if (!tRes.rows[0]) return res.status(404).json({ error: 'Tournament not found' });
    res.json({ ...tRes.rows[0], tournament_teams: teamsRes.rows, rounds: roundsRes.rows });
  } catch (e) { next(e); }
});

// ── POST create tournament ───────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const {
      name, format, num_groups, playoff_teams,
      sets_per_match, points_per_set,
      start_date, end_date, description, court_ids,
      league_legs,
    } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO tournaments
         (name, format, num_groups, playoff_teams,
          sets_per_match, points_per_set,
          start_date, end_date, description, court_ids,
          league_legs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        name,
        format,
        num_groups    || 1,
        playoff_teams || 4,
        sets_per_match  || 3,
        points_per_set  || 21,
        start_date  || null,
        end_date    || null,
        description || null,
        court_ids   || null,
        league_legs === 2 ? 2 : 1,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// ── PUT update tournament ────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const {
      name, format, num_groups, playoff_teams,
      sets_per_match, points_per_set,
      start_date, end_date, description, court_ids, status,
      league_legs,
    } = req.body;

    const { rows } = await pool.query(
      `UPDATE tournaments
          SET name           = $1,
              format         = $2,
              num_groups     = $3,
              playoff_teams  = $4,
              sets_per_match = $5,
              points_per_set = $6,
              start_date     = $7,
              end_date       = $8,
              description    = $9,
              court_ids      = $10,
              status         = $11,
              league_legs    = $12
        WHERE id = $13
        RETURNING *`,
      [
        name, format, num_groups, playoff_teams,
        sets_per_match, points_per_set,
        start_date || null, end_date || null, description || null,
        court_ids  || null, status || 'draft',
        league_legs === 2 ? 2 : 1,
        req.params.id,
      ]
    );
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// ── DELETE tournament ────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM tournaments WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ── POST assign teams to tournament ─────────────────────────
router.post('/:id/teams', async (req, res, next) => {
  try {
    const { team_ids } = req.body;
    const tid = req.params.id;

    const tRes = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tid]);
    const t    = tRes.rows[0];
    if (!t) return res.status(404).json({ error: 'Tournament not found' });

    const numGroups = t.num_groups || 1;
    const GROUPS    = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    // Remove old assignments
    await pool.query('DELETE FROM tournament_teams WHERE tournament_id = $1', [tid]);

    for (let i = 0; i < team_ids.length; i++) {
      const group = GROUPS[i % numGroups];
      await pool.query(
        `INSERT INTO tournament_teams (tournament_id, team_id, group_name, seeding)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [tid, team_ids[i], group, i + 1]
      );
    }
    res.json({ success: true, count: team_ids.length });
  } catch (e) { next(e); }
});

// ── POST generate fixtures ───────────────────────────────────
router.post('/:id/generate-fixtures', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tid = req.params.id;

    const tRes = await client.query('SELECT * FROM tournaments WHERE id = $1', [tid]);
    const t    = tRes.rows[0];
    if (!t) throw Object.assign(new Error('Tournament not found'), { status: 404 });

    const teamsRes = await client.query(
      `SELECT tt.*, tm.name
         FROM tournament_teams tt
         JOIN teams tm ON tm.id = tt.team_id
        WHERE tt.tournament_id = $1
        ORDER BY tt.group_name, tt.seeding`,
      [tid]
    );
    const allTeams = teamsRes.rows;
    if (allTeams.length < 2)
      throw Object.assign(new Error('Need at least 2 teams'), { status: 400 });

    // Wipe any existing rounds / matches
    await client.query('DELETE FROM rounds WHERE tournament_id = $1', [tid]);

    // Resolve courts
    const courtIds = Array.isArray(t.court_ids) && t.court_ids.length
      ? t.court_ids
      : (await client.query('SELECT id FROM courts WHERE is_available = true ORDER BY name')).rows.map(r => r.id);

    let matchNum = 1;

    if (t.format === 'round_robin') {
      matchNum = await generateRoundRobin(client, t, allTeams, courtIds, matchNum);
    } else if (t.format === 'knockout') {
      matchNum = await generateKnockout(client, t, allTeams, courtIds, matchNum);
    } else if (t.format === 'playoff') {
      // Phase 1 – group-stage round-robin (no auto-playoff appended here)
      matchNum = await generateRoundRobin(client, t, allTeams, courtIds, matchNum);
      // Phase 2 – IPL playoff bracket (empty slots, filled after standings settle)
      matchNum = await generateIPLPlayoffs(client, t, courtIds, matchNum);
    }

    // Initialise standings rows for every team
    await client.query('DELETE FROM standings WHERE tournament_id = $1', [tid]);
    for (const team of allTeams) {
      await client.query(
        `INSERT INTO standings (tournament_id, team_id, group_name)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [tid, team.team_id, team.group_name]
      );
    }

    await client.query("UPDATE tournaments SET status = 'active' WHERE id = $1", [tid]);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Fixtures generated successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

// ── POST manually advance playoffs (fallback button) ─────────
router.post('/:id/advance-playoffs', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tid = req.params.id;

    const tRes = await client.query('SELECT * FROM tournaments WHERE id = $1', [tid]);
    const t    = tRes.rows[0];
    if (!t) return res.status(404).json({ error: 'Tournament not found' });

    // Compute live standings from match results (standings table rows are never updated during play)
    // Compute live standings from league matches — mirrors standings.js logic exactly
    const teamsRes = await client.query(
      `SELECT tt.team_id, tt.group_name FROM tournament_teams tt WHERE tt.tournament_id = $1`,
      [tid]
    );
    const leagueMatchRes = await client.query(
      `SELECT m.team1_id, m.team2_id, m.winner_team_id, m.team1_score, m.team2_score, m.set_scores
         FROM matches m
         JOIN rounds r ON r.id = m.round_id
        WHERE r.tournament_id = $1
          AND r.round_type IN ('league', 'group_stage')
          AND m.status = 'completed'
          AND m.winner_team_id IS NOT NULL`,
      [tid]
    );

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
      // Rule 3: Set difference (fallback — no h2h tracked in seeding path)
      return (b.sets_for - b.sets_against) - (a.sets_for - a.sets_against);
    });

    const playoffTeams = t.playoff_teams || 4;
    const seeds = allTeamsSorted.slice(0, playoffTeams);

    if (t.format === 'playoff') {
      await seedIPLBracket(client, tid, seeds);
    } else {
      await seedGenericKnockout(client, tid, seeds);
    }

    await client.query('COMMIT');
    res.json({ success: true, qualifiers: seeds });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

// ============================================================
// FIXTURE GENERATORS
// ============================================================

// ── Round-Robin (per group) ───────────────────────────────────
async function generateRoundRobin(client, t, teams, courts, startNum) {
  const groups = {};
  for (const team of teams) {
    const g = team.group_name || 'A';
    if (!groups[g]) groups[g] = [];
    groups[g].push(team);
  }

  const legs      = (t.league_legs === 2) ? 2 : 1;
  let matchNum    = startNum;
  let roundOffset = 0;

  for (const [groupName, groupTeams] of Object.entries(groups)) {
    const pairs     = buildRRPairs(groupTeams);
    const numRounds = pairs.length;

    for (let leg = 1; leg <= legs; leg++) {
      for (let r = 0; r < numRounds; r++) {
        const globalRound = roundOffset + (leg - 1) * numRounds + r + 1;

        const rRes = await client.query(
          `INSERT INTO rounds (tournament_id, round_number, round_type, group_name, status)
           VALUES ($1, $2, 'league', $3, 'pending')
           RETURNING id`,
          [t.id, globalRound, groupName]
        );
        const roundId    = rRes.rows[0].id;
        const roundPairs = pairs[r] || [];

        for (let i = 0; i < roundPairs.length; i++) {
          // Leg 1: team1 is home (as generated by circle algorithm)
          // Leg 2: teams are swapped so each side hosts once
          let team1 = roundPairs[i][0];
          let team2 = roundPairs[i][1];
          if (leg === 2) { const tmp = team1; team1 = team2; team2 = tmp; }

          const court      = courts.length ? courts[i % courts.length] : null;
          const isHomeLeg  = true; // team1 is always the home side for that leg

          await client.query(
            `INSERT INTO matches
               (tournament_id, round_id, court_id, team1_id, team2_id,
                match_number, status, leg_number, is_home_leg)
             VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7, $8)`,
            [t.id, roundId, court, team1.team_id, team2.team_id,
             matchNum++, leg, isHomeLeg]
          );
        }
      }
    }
    roundOffset += numRounds * legs;
  }

  return matchNum;
}

// ── Standard Knockout ────────────────────────────────────────
async function generateKnockout(client, t, teams, courts, startNum) {
  const size       = nextPow2(teams.length);
  const seeded     = [...teams];
  while (seeded.length < size) seeded.push(null); // byes

  let matchNum   = startNum;
  const totalR   = Math.log2(size);

  for (let r = 0; r < totalR; r++) {
    const mc       = size / Math.pow(2, r + 1);
    const roundType = getKnockoutRoundType(r, totalR);

    const rRes = await client.query(
      `INSERT INTO rounds (tournament_id, round_number, round_type, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id`,
      [t.id, r + 1, roundType]
    );
    const roundId = rRes.rows[0].id;

    for (let i = 0; i < mc; i++) {
      const team1 = r === 0 ? seeded[i * 2]     : null;
      const team2 = r === 0 ? seeded[i * 2 + 1] : null;
      const court = courts.length ? courts[i % courts.length] : null;
      const st    = (!team1 || !team2) ? 'walkover' : 'scheduled';

      await client.query(
        `INSERT INTO matches
           (tournament_id, round_id, court_id, team1_id, team2_id, match_number, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [t.id, roundId, court,
         team1 ? team1.team_id : null,
         team2 ? team2.team_id : null,
         matchNum++, st]
      );
    }
  }
  return matchNum;
}

// ── IPL Playoff Bracket ───────────────────────────────────────
// Creates 4 empty matches:
//   Qualifier 1   (Rank1 vs Rank2)  → winner to Final directly
//   Eliminator    (Rank3 vs Rank4)  → loser out, winner to Q2
//   Qualifier 2   (Q1-loser vs Elim-winner) → winner to Final
//   Final         (Q1-winner vs Q2-winner)
//
// Teams are filled in after league stage by auto/manual seeding.
async function generateIPLPlayoffs(client, t, courts, startNum) {
  // Get the current max round_number so we append after league rounds
  const maxRRes = await client.query(
    'SELECT COALESCE(MAX(round_number), 0) AS mx FROM rounds WHERE tournament_id = $1',
    [t.id]
  );
  let roundNum = parseInt(maxRRes.rows[0].mx);
  let matchNum = startNum;

  const stages = [
    { type: 'qualifier1', label: 'Qualifier 1' },
    { type: 'eliminator', label: 'Eliminator'  },
    { type: 'qualifier2', label: 'Qualifier 2' },
    { type: 'final',      label: 'Final'        },
  ];

  for (const stage of stages) {
    roundNum++;
    const rRes = await client.query(
      `INSERT INTO rounds (tournament_id, round_number, round_type, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id`,
      [t.id, roundNum, stage.type]
    );
    const roundId = rRes.rows[0].id;
    const court   = courts.length ? courts[0] : null;

    // One match per stage; teams will be NULL until seeding runs
    await client.query(
      `INSERT INTO matches
         (tournament_id, round_id, court_id, team1_id, team2_id, match_number, status)
       VALUES ($1, $2, $3, NULL, NULL, $4, 'scheduled')`,
      [t.id, roundId, court, matchNum++]
    );
  }

  return matchNum;
}

// ── Seed IPL bracket ─────────────────────────────────────────
async function seedIPLBracket(client, tournamentId, seeds) {
  if (seeds.length < 2) return;

  // Qualifier 1 → seeds[0] vs seeds[1]
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

  // Eliminator → seeds[2] vs seeds[3]
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

// ── Seed generic knockout first round ────────────────────────
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
    'SELECT id FROM matches WHERE round_id = $1 ORDER BY match_number',
    [roundRes.rows[0].id]
  );

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

// ============================================================
// UTILITY
// ============================================================

function buildRRPairs(teams) {
  const n      = teams.length % 2 === 0 ? teams.length : teams.length + 1;
  const padded = [...teams];
  if (teams.length % 2 !== 0) padded.push(null);

  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = padded[i], b = padded[n - 1 - i];
      if (a && b) pairs.push([a, b]);
    }
    rounds.push(pairs);
    // Rotate all except first element
    padded.splice(1, 0, padded.pop());
  }
  return rounds;
}

function nextPow2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function getKnockoutRoundType(r, totalRounds) {
  if (r === totalRounds - 1) return 'final';
  if (r === totalRounds - 2) return 'semifinal';
  if (r === totalRounds - 3) return 'quarterfinal';
  return 'knockout';
}
