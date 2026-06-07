// ─── Round-Robin Pair Generator (Circle Algorithm) ─────────────────────────
export function rrPairs(teams) {
  const n = teams.length % 2 === 0 ? teams.length : teams.length + 1;
  const p = [...teams];
  if (teams.length % 2 !== 0) p.push(null); // bye
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = p[i], b = p[n - 1 - i];
      if (a && b) pairs.push([a, b]);
    }
    rounds.push(pairs);
    p.splice(1, 0, p.pop()); // rotate all but first
  }
  return rounds;
}

// ─── Next Power of 2 ──────────────────────────────────────────────────────
export const pow2 = n => { let p = 1; while (p < n) p *= 2; return p; };

// ─── Round Labels ──────────────────────────────────────────────────────────
export const ROUND_LABEL = {
  league:       'League',
  group_stage:  'Group Stage',
  quarterfinal: 'Quarter-Finals',
  semifinal:    'Semi-Finals',
  final:        'Grand Final',
  third_place:  '3rd Place',
  knockout:     'Knockout',
};

// ─── Format colors ─────────────────────────────────────────────────────────
export const FORMAT_COLOR  = { round_robin: '#3B82F6', knockout: '#EF4444', playoff: '#8B5CF6' };
export const STATUS_COLOR  = { scheduled: '#94A3B8', ongoing: '#F59E0B', completed: '#10B981', walkover: '#CBD5E1' };
export const SKILL_COLOR   = { beginner: '#10B981', intermediate: '#3B82F6', advanced: '#8B5CF6', pro: '#F59E0B' };

// ─── Standings Calculator (client-side for live use) ──────────────────────
export function calcStandings(tournament) {
  const map = {};
  for (const tt of (tournament.tournament_teams || [])) {
    map[tt.team_id || tt.id] = {
      team_id:   tt.team_id || tt.id,
      team_name: tt.name || tt.team_name || '?',
      color:     tt.color || '#888',
      logo_url:  tt.logo_url || '',
      group_name: tt.group_name || 'A',
      played: 0, won: 0, lost: 0,
      sets_for: 0, sets_against: 0,
      pts_for: 0, pts_against: 0,
      points: 0,
    };
  }

  const h2h = {};

  for (const round of (tournament.rounds || [])) {
    if (!['league', 'group_stage'].includes(round.round_type)) continue;
    for (const m of (round.matches || [])) {
      if (m.status !== 'completed' || !m.winner_team_id) continue;
      const s1 = map[m.team1_id], s2 = map[m.team2_id];
      if (!s1 || !s2) continue;

      s1.played++; s2.played++;
      let t1s = 0, t2s = 0, t1p = 0, t2p = 0;
      for (const s of (m.set_scores || [])) {
        t1s += s.t1 > s.t2 ? 1 : 0;
        t2s += s.t2 > s.t1 ? 1 : 0;
        t1p += s.t1 || 0;
        t2p += s.t2 || 0;
      }
      s1.sets_for += t1s; s1.sets_against += t2s;
      s2.sets_for += t2s; s2.sets_against += t1s;
      s1.pts_for += t1p; s1.pts_against += t2p;
      s2.pts_for += t2p; s2.pts_against += t1p;

      if (m.winner_team_id === m.team1_id) { s1.won++; s2.lost++; s1.points += 2; }
      else { s2.won++; s1.lost++; s2.points += 2; }

      const key = [m.team1_id, m.team2_id].sort().join('_');
      if (!h2h[key]) h2h[key] = {};
      h2h[key][m.winner_team_id] = (h2h[key][m.winner_team_id] || 0) + 1;
    }
  }

  // Group and sort with H2H tiebreaker
  const byGroup = {};
  for (const s of Object.values(map)) {
    const g = s.group_name || 'A';
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(s);
  }

  const result = [];
  for (const [, rows] of Object.entries(byGroup).sort()) {
    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const da = a.sets_for - a.sets_against, db = b.sets_for - b.sets_against;
      if (db !== da) return db - da;
      // H2H tiebreaker
      const key = [a.team_id, b.team_id].sort().join('_');
      const h = h2h[key];
      if (h) {
        const aw = h[a.team_id] || 0, bw = h[b.team_id] || 0;
        if (bw !== aw) return bw - aw;
      }
      return (b.pts_for - b.pts_against) - (a.pts_for - a.pts_against);
    });
    rows.forEach((r, i) => { r.rank = i + 1; });
    result.push(...rows);
  }
  return result;
}

// ─── PDF Export ────────────────────────────────────────────────────────────
export function exportTournamentPDF(tournament, standings) {
  const now = new Date().toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const allRounds   = tournament.rounds || [];
  const leagueRounds = allRounds.filter(r => r.round_type === 'league');
  const koRounds     = allRounds.filter(r => r.round_type !== 'league');

  const css = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#0F172A;padding:32px;font-size:13px}
    h1{font-size:30px;font-weight:900;letter-spacing:0.5px;margin-bottom:4px}
    h2{font-size:17px;font-weight:800;margin:24px 0 10px;padding-bottom:6px;border-bottom:2px solid #0F172A}
    h3{font-size:13px;font-weight:700;margin:16px 0 8px;color:#475569;text-transform:uppercase;letter-spacing:0.5px}
    table{width:100%;border-collapse:collapse;margin-bottom:16px}
    th{background:#0F172A;color:#fff;padding:7px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;text-align:center}
    td{padding:7px 10px;border-bottom:1px solid #E2E8F0;text-align:center;font-size:12px}
    .tl{text-align:left}.tr{text-align:right}
    .fw7{font-weight:700}.fw9{font-weight:900;font-size:14px}
    .green{color:#166534}.red{color:#991B1B}.amber{color:#B45309}
    .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase}
    .hdr{border-bottom:3px solid #0F172A;padding-bottom:16px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start}
    .champ{background:#FFF7ED;border-left:4px solid #F59E0B;border-radius:8px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:16px}
    .footer{margin-top:32px;padding-top:14px;border-top:1px solid #E2E8F0;font-size:10px;color:#94A3B8;text-align:center}
    tr:nth-child(even) td{background:#F8FAFC}
    @media print{body{padding:16px}}
  `;

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>${tournament.name} — Match Summary</title><style>${css}</style></head><body>
  <div class="hdr">
    <div>
      <h1>🏸 ${tournament.name}</h1>
      <div style="margin-top:8px;display:flex;gap:8px">
        <span class="badge" style="background:#0F172A18;color:#0F172A">${(tournament.format||'').replace(/_/g,' ').toUpperCase()}</span>
        <span class="badge" style="background:#DCFCE7;color:#166534">COMPLETED</span>
      </div>
    </div>
    <div style="text-align:right;font-size:11px;color:#64748B;line-height:1.8">
      Generated: ${now}<br>
      Format: Best of ${tournament.sets_per_match||3} · ${tournament.points_per_set||21} pts/set<br>
      ${tournament.tournament_teams?.length||0} teams · ${(tournament.rounds||[]).flatMap(r=>r.matches||[]).filter(m=>m.status==='completed').length} matches played
    </div>
  </div>`;

  // Champion banner
  if (tournament.winner_name || tournament.winner_team_id) {
    html += `<div class="champ">
      <span style="font-size:52px">🏆</span>
      <div>
        <div style="font-size:11px;font-weight:700;color:#92400E;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Tournament Champion</div>
        <div style="font-size:28px;font-weight:900;color:#B45309">${tournament.winner_name||'Champion'}</div>
      </div>
    </div>`;
  }

  // Standings table
  if (standings && standings.length > 0) {
    html += `<h2>Final Standings</h2>`;
    const byGroup = {};
    for (const s of standings) {
      const g = s.group_name || 'A';
      if (!byGroup[g]) byGroup[g] = [];
      byGroup[g].push(s);
    }
    for (const [g, rows] of Object.entries(byGroup).sort()) {
      if (Object.keys(byGroup).length > 1) html += `<h3>Group ${g}</h3>`;
      html += `<table>
        <thead><tr>
          <th class="tl" style="width:32px">#</th>
          <th class="tl">Team</th>
          <th>MP</th><th>W</th><th>L</th>
          <th>SF</th><th>SA</th><th>S±</th>
          <th>PF</th><th>PA</th><th>Pts</th>
        </tr></thead><tbody>`;
      rows.forEach((s, i) => {
        const sd = s.sets_for - s.sets_against;
        const rankColors = ['#F59E0B','#94A3B8','#CD7F32'];
        html += `<tr>
          <td class="tl fw7" style="color:${rankColors[i]||'#64748B'}">${i+1}</td>
          <td class="tl fw7">${s.team_name||s.name}</td>
          <td>${s.played}</td>
          <td class="green fw7">${s.won}</td>
          <td class="red">${s.lost}</td>
          <td>${s.sets_for}</td>
          <td>${s.sets_against}</td>
          <td class="fw7" style="color:${sd>0?'#166534':sd<0?'#991B1B':'#64748B'}">${sd>0?'+':''}${sd}</td>
          <td>${s.pts_for||s.points_for||0}</td>
          <td>${s.pts_against||s.points_against||0}</td>
          <td class="fw9">${s.points}</td>
        </tr>`;
      });
      html += `</tbody></table>`;
    }
  }

  // Match results by round
  html += `<h2>Match Results</h2>`;
  for (const round of allRounds) {
    const done = (round.matches || []).filter(m => m.status === 'completed');
    if (done.length === 0) continue;
    const rTitle = (round.group_name ? `Group ${round.group_name} — ` : '')
      + (ROUND_LABEL[round.round_type] || round.round_type).toUpperCase()
      + (round.round_type === 'league' ? ` · Round ${round.round_number}` : '');
    html += `<h3>${rTitle}</h3>
      <table>
        <thead><tr>
          <th style="width:40px">#</th>
          <th class="tl">Team 1</th>
          <th>Sets W</th>
          <th>Set Scores</th>
          <th>Sets W</th>
          <th class="tr">Team 2</th>
          <th class="tl">Winner</th>
          ${round.matches.some(m=>m.court_name) ? '<th>Court</th>' : ''}
        </tr></thead><tbody>`;
    done.forEach(m => {
      const winner = m.winner_team_id === m.team1_id ? m.team1_name : m.team2_name;
      const scores = (m.set_scores || []).map(s => `${s.t1}–${s.t2}`).join(', ');
      html += `<tr>
        <td style="color:#64748B">#${m.match_number}</td>
        <td class="tl ${m.winner_team_id===m.team1_id?'green fw7':''}">${m.team1_name||'TBD'}</td>
        <td class="${m.winner_team_id===m.team1_id?'green':'red'} fw7">${m.team1_score}</td>
        <td style="color:#475569;font-size:11px">${scores||'—'}</td>
        <td class="${m.winner_team_id===m.team2_id?'green':'red'} fw7">${m.team2_score}</td>
        <td class="tr ${m.winner_team_id===m.team2_id?'green fw7':''}">${m.team2_name||'TBD'}</td>
        <td class="tl fw7">${winner}</td>
        ${round.matches.some(m=>m.court_name) ? `<td>${m.court_name||'—'}</td>` : ''}
      </tr>`;
    });
    html += `</tbody></table>`;
  }

  html += `<div class="footer">SmashCourt Tournament Manager &nbsp;·&nbsp; ${now}</div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
  }
}
