import { TeamDot, Badge } from './ui';
import { clsx } from 'clsx';

const RANK_COLORS = ['#F59E0B', '#94A3B8', '#CD7F32'];

export default function StandingsTable({ standings = [], tournament, showQualifier = false }) {
  if (!standings.length) {
    return (
      <div className="rounded-xl bg-white border border-[#E2E8F0] p-10 text-center text-slate-400 text-sm">
        No standings data yet. Play some league matches to see standings.
      </div>
    );
  }

  // Group by group_name
  const byGroup = {};
  for (const s of standings) {
    const g = s.group_name || 'A';
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(s);
  }

  const multiGroup = Object.keys(byGroup).length > 1;
  const playoffTeams = tournament?.playoff_teams || 4;
  const perGroup = multiGroup ? Math.ceil(playoffTeams / Object.keys(byGroup).length) : playoffTeams;

  return (
    <div>
      {Object.entries(byGroup).sort().map(([group, rows]) => (
        <div key={group} className="mb-6">
          {multiGroup && (
            <h2
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 20, marginBottom: 12 }}
            >
              Group {group}
            </h2>
          )}

          <div className="rounded-xl overflow-hidden border border-[#E2E8F0]">
            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 36 }} />
                <col />
                <col style={{ width: 40 }} />
                <col style={{ width: 40 }} />
                <col style={{ width: 40 }} />
                <col style={{ width: 48 }} />
                <col style={{ width: 48 }} />
                <col style={{ width: 52 }} />
                <col style={{ width: 48 }} />
                <col style={{ width: 48 }} />
                <col style={{ width: 52 }} />
              </colgroup>
              <thead>
                <tr style={{ background: '#0F172A' }}>
                  {['#', 'Team', 'MP', 'W', 'L', 'SF', 'SA', 'S±', 'PF', 'PA', 'Pts'].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        padding: '9px 8px',
                        fontSize: 10, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: 0.5,
                        color: h === 'Pts' ? '#22D3EE' : 'rgba(255,255,255,0.75)',
                        textAlign: i < 2 ? 'left' : 'center',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => {
                  const isQ = showQualifier && i < perGroup;
                  const sd  = s.sets_for - s.sets_against;
                  const pd  = (s.pts_for || 0) - (s.pts_against || 0);
                  return (
                    <tr
                      key={s.team_id}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        background: isQ ? '#F0FDF4' : i % 2 === 0 ? '#fff' : '#FAFAFA',
                      }}
                    >
                      {/* Rank */}
                      <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 700, fontSize: 13, color: RANK_COLORS[i] || '#94A3B8' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </td>

                      {/* Team */}
                      <td style={{ padding: '9px 8px' }}>
                        <div className="flex items-center gap-2">
                          <TeamDot color={s.color} size={10} />
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{s.team_name || s.name}</span>
                          {isQ && <Badge label="Q" color="#166534" bg="#DCFCE7" />}
                        </div>
                      </td>

                      {/* Stats */}
                      {[s.played, s.won, s.lost, s.sets_for, s.sets_against].map((v, vi) => (
                        <td
                          key={vi}
                          style={{
                            padding: '9px 8px', textAlign: 'center', fontSize: 13,
                            fontWeight: vi === 1 ? 700 : 400,
                            color: vi === 1 ? '#10B981' : vi === 2 ? '#EF4444' : '#475569',
                          }}
                        >
                          {v}
                        </td>
                      ))}

                      {/* Set diff */}
                      <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 700, fontSize: 13, color: sd > 0 ? '#10B981' : sd < 0 ? '#EF4444' : '#94A3B8' }}>
                        {sd > 0 ? '+' : ''}{sd}
                      </td>

                      {/* Points for / against */}
                      {[s.pts_for || 0, s.pts_against || 0].map((v, vi) => (
                        <td key={vi} style={{ padding: '9px 8px', textAlign: 'center', fontSize: 12, color: '#64748B' }}>{v}</td>
                      ))}

                      {/* Points */}
                      <td style={{ padding: '9px 8px', textAlign: 'center', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 16, color: '#0F172A' }}>
                        {s.points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {showQualifier && multiGroup && (
            <div className="flex gap-4 text-[11px] text-slate-400 mt-2">
              <span><Badge label="Q" color="#166534" bg="#DCFCE7" /> Qualifies for playoffs</span>
              <span>Tiebreaker: Points → Set diff → H2H → Point diff</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
