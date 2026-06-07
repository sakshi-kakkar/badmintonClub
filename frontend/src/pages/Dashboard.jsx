import { useQuery } from 'react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getTournaments } from '../utils/api';
import { StatCard, Badge, TeamDot, Card, ProgressBar } from '../components/ui';
import { FORMAT_COLOR } from '../utils/fixtures';

export default function Dashboard() {
  const { data: tournaments = [], isLoading } = useQuery('tournaments', getTournaments, { refetchInterval: 15000 });
  const navigate = useNavigate();

  const active    = tournaments.filter(t => t.status === 'active');
  const completed = tournaments.filter(t => t.status === 'completed');
  const allMatches = tournaments.flatMap(t => (t.rounds || []).flatMap(r => r.matches || []));
  const live      = allMatches.filter(m => m.status === 'ongoing');
  const played    = allMatches.filter(m => m.status === 'completed');

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px' }}>
      {/* Heading */}
      <div className="mb-7">
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 38, letterSpacing: 0.5, lineHeight: 1 }}>
          CLUB DASHBOARD
        </h1>
        <p className="text-slate-500 text-sm mt-1.5">Overview of your badminton club activity</p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-3 mb-7" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <StatCard icon="🏆" value={tournaments.length} label="Tournaments"    accent="#F59E0B" />
        <StatCard icon="⚡" value={active.length}      label="Active"         accent="#10B981" />
        <StatCard icon="🔴" value={live.length}        label="Live Matches"   accent="#EF4444" />
        <StatCard icon="📊" value={played.length}      label="Matches Played" accent="#3B82F6" />
        <StatCard icon="✅" value={completed.length}   label="Completed"      accent="#8B5CF6" />
      </div>

      {/* Live matches banner */}
      {live.length > 0 && (
        <div className="rounded-xl p-4 mb-6 border border-[#FCD34D]" style={{ background: '#FFFBEB' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="animate-pulse text-[10px] font-black text-red-500">🔴 LIVE NOW</span>
            <span className="font-bold text-slate-800 text-sm">{live.length} match{live.length !== 1 ? 'es' : ''} in progress</span>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {live.map(m => (
              <div key={m.id} className="bg-white border border-[#FCD34D] rounded-lg px-3 py-2.5 flex justify-between items-center gap-3">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <TeamDot color={m.team1_color} size={8} />
                  <span className="font-bold text-xs truncate">{m.team1_name}</span>
                </div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20 }}>
                  {m.team1_score}–{m.team2_score}
                </div>
                <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                  <span className="font-bold text-xs truncate text-right">{m.team2_name}</span>
                  <TeamDot color={m.team2_color} size={8} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Active Tournaments */}
        <Card className="p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18 }}>
              🏆 Active Tournaments
            </h2>
            <Link to="/tournaments" className="text-xs font-bold text-slate-400 hover:text-slate-700 no-underline border border-[#E2E8F0] rounded-lg px-3 py-1">
              View All
            </Link>
          </div>
          {isLoading ? (
            <div className="text-slate-400 text-sm text-center py-6">Loading...</div>
          ) : active.length === 0 ? (
            <div className="text-slate-400 text-sm text-center py-6">No active tournaments</div>
          ) : (
            active.map(t => {
              const allM = (t.rounds || []).flatMap(r => r.matches || []);
              const done = allM.filter(m => m.status === 'completed').length;
              return (
                <div
                  key={t.id}
                  onClick={() => navigate(`/tournaments/${t.id}`)}
                  className="py-3 border-b border-[#F1F5F9] cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded-lg"
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="font-bold text-sm text-slate-800">{t.name}</div>
                    <Badge label={(t.format || '').replace('_', ' ')} color={FORMAT_COLOR[t.format] || '#666'} />
                  </div>
                  <ProgressBar value={done} max={allM.length} />
                </div>
              );
            })
          )}
        </Card>

        {/* Champions Hall */}
        <Card className="p-5">
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, marginBottom: 16 }}>
            🥇 Champions Hall
          </h2>
          {completed.length === 0 ? (
            <div className="text-slate-400 text-sm text-center py-6">No completed tournaments yet</div>
          ) : (
            completed.slice(0, 7).map(t => (
              <div
                key={t.id}
                onClick={() => navigate(`/tournaments/${t.id}`)}
                className="flex justify-between items-center py-2.5 border-b border-[#F1F5F9] cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded-lg"
              >
                <div>
                  <div className="font-bold text-sm text-slate-800">{t.name}</div>
                  <div className="text-[11px] text-slate-400">{(t.format || '').replace('_', ' ').toUpperCase()}</div>
                </div>
                {t.winner_name && (
                  <div className="flex items-center gap-2">
                    <TeamDot color={t.winner_color || '#888'} size={10} />
                    <span className="font-bold text-sm">{t.winner_name}</span>
                    <span>🏆</span>
                  </div>
                )}
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
