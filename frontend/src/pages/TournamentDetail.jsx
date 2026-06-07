import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import {
  getTournament, generateFixtures, advancePlayoffs,
  updateMatchScore, updateMatchStatus, assignMatchCourt, getCourts,
} from '../utils/api';
import {
  Badge, Button, Tabs, TeamDot, Avatar,
  ProgressBar, Spinner, EmptyState,
} from '../components/ui';
import MatchCard       from '../components/MatchCard';
import StandingsTable  from '../components/StandingsTable';
import BracketView     from '../components/BracketView';
import { FORMAT_COLOR, ROUND_LABEL, calcStandings, exportTournamentPDF } from '../utils/fixtures';

// ── Champion Banner ─────────────────────────────────────────────────────────
function ChampionBanner({ tournament }) {
  if (tournament.status !== 'completed' || !tournament.winner_team_id) return null;
  return (
    <div
      className="rounded-xl p-5 mb-6 flex items-center gap-4"
      style={{
        background: 'linear-gradient(135deg, #FFF7ED, #FEF3C7)',
        border: '1px solid #FCD34D',
        borderLeft: '4px solid #F59E0B',
      }}
    >
      <span style={{ fontSize: 52 }}>🏆</span>
      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-1">
          Tournament Champion
        </div>
        <div
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 30, color: '#B45309' }}
        >
          {tournament.winner_name || '?'}
        </div>
      </div>
    </div>
  );
}

// ── Fixtures Tab ────────────────────────────────────────────────────────────
function FixturesTab({ tournament, onMatchUpdate }) {
  const rounds = tournament.rounds || [];

  if (!rounds.length) {
    return (
      <EmptyState
        icon="🏸"
        title="No fixtures generated yet"
        subtitle="Click 'Generate Fixtures' above to auto-create the full match schedule"
      />
    );
  }

  return (
    <div>
      {rounds.map(round => {
        const done  = (round.matches || []).filter(m => m.status === 'completed').length;
        const total = (round.matches || []).length;
        return (
          <div key={round.id} className="mb-8">
            {/* Round header */}
            <div className="flex items-center gap-3 mb-3">
              <div
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 17, color: '#0F172A' }}
              >
                {round.group_name
                  ? <span style={{ color: FORMAT_COLOR[tournament.format] }}>GROUP {round.group_name} — </span>
                  : null
                }
                {(ROUND_LABEL[round.round_type] || round.round_type).toUpperCase()}
                {round.round_type === 'league' && ` · ROUND ${round.round_number}`}
              </div>
              <div className="flex-1 h-px bg-[#E2E8F0]" />
              <span
                className="text-[11px] font-bold rounded px-2 py-0.5"
                style={{ background: '#F1F5F9', color: '#64748B' }}
              >
                {done}/{total} done
              </span>
            </div>

            {/* Match grid */}
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}
            >
              {(round.matches || []).map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  tournament={tournament}
                  onUpdate={onMatchUpdate}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Teams Tab ───────────────────────────────────────────────────────────────
function TeamsTab({ tournament }) {
  const tTeams = tournament.tournament_teams || [];
  if (!tTeams.length) {
    return (
      <EmptyState icon="🛡" title="No teams assigned" subtitle="Teams are added when creating the tournament." />
    );
  }

  const byGroup = {};
  for (const tt of tTeams) {
    const g = tt.group_name || 'A';
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(tt);
  }

  const multiGroup = Object.keys(byGroup).length > 1;

  return (
    <div>
      {Object.entries(byGroup).sort().map(([g, tts]) => (
        <div key={g} className="mb-8">
          {multiGroup && (
            <h2
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 20, marginBottom: 12, color: '#0F172A' }}
            >
              Group {g}
            </h2>
          )}
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}
          >
            {tts.map(tt => (
              <div key={tt.team_id || tt.id} className="bg-white border border-[#E2E8F0] rounded-xl p-4">
                {/* Team header */}
                <div className="flex items-center gap-3 mb-3">
                  <Avatar
                    name={tt.name}
                    photoUrl={tt.logo_url}
                    color={tt.color}
                    size={42}
                    radius="9px"
                  />
                  <div>
                    <div
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16 }}
                    >
                      {tt.name}
                    </div>
                    {tt.seeding && (
                      <div className="text-[11px] text-slate-400">Seed #{tt.seeding}</div>
                    )}
                  </div>
                </div>

                {/* Members */}
                {(tt.members || []).map(m => (
                  <div key={m.id} className="flex items-center gap-2 py-1">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500 flex-shrink-0"
                      style={{ background: '#E2E8F0' }}
                    >
                      {m.name?.charAt(0)}
                    </div>
                    <span
                      className="text-xs"
                      style={{ fontWeight: m.role === 'captain' ? 700 : 400 }}
                    >
                      {m.name}
                    </span>
                    {m.role === 'captain' && (
                      <span className="text-[9px] bg-yellow-100 text-yellow-800 px-1.5 rounded font-bold uppercase">C</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Tournament Detail ───────────────────────────────────────────────────
export default function TournamentDetail() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const qc         = useQueryClient();
  const [activeTab, setActiveTab] = useState('fixtures');

  // Load tournament
  const {
    data: tournament,
    isLoading,
    error,
  } = useQuery(
    ['tournament', id],
    () => getTournament(id),
    { refetchInterval: 8000 }
  );

  // Load courts for assignment
  const { data: courts = [] } = useQuery('courts', getCourts);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const genMutation = useMutation(() => generateFixtures(id), {
    onSuccess: () => {
      qc.invalidateQueries(['tournament', id]);
      qc.invalidateQueries('tournaments');
      toast.success('Fixtures generated! 🏸');
    },
    onError: err => toast.error(err.message),
  });

  const advanceMutation = useMutation(() => advancePlayoffs(id), {
    onSuccess: () => {
      qc.invalidateQueries(['tournament', id]);
      toast.success('Playoff teams seeded!');
    },
    onError: err => toast.error(err.message),
  });

  // ── Match update handler (score + status) ─────────────────────────────────
  const handleMatchUpdate = useCallback(async (matchId, data) => {
    try {
      if (data.set_scores !== undefined) {
        await updateMatchScore(matchId, data);
      } else if (data.status) {
        await updateMatchStatus(matchId, data);
      } else if (data.court_id !== undefined) {
        await assignMatchCourt(matchId, data);
      }
      qc.invalidateQueries(['tournament', id]);
      qc.invalidateQueries('tournaments');
    } catch (err) {
      toast.error(err.message);
    }
  }, [id, qc]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Spinner size={36} />
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px' }}>
        <EmptyState
          icon="⚠️"
          title="Tournament not found"
          subtitle={error?.message}
          action={<Button variant="dark" onClick={() => navigate('/tournaments')}>← Back to Tournaments</Button>}
        />
      </div>
    );
  }

  // ── Computed values ───────────────────────────────────────────────────────
  const allMatches     = (tournament.rounds || []).flatMap(r => r.matches || []);
  const totalMatches   = allMatches.length;
  const playedMatches  = allMatches.filter(m => m.status === 'completed').length;
  const liveMatches    = allMatches.filter(m => m.status === 'ongoing').length;
  const standings      = calcStandings(tournament);

  const leagues        = (tournament.rounds || []).filter(r => ['league','group_stage'].includes(r.round_type));
  const leagueDone     = leagues.length > 0 && leagues.every(r => (r.matches || []).every(m => m.status === 'completed' || m.status === 'walkover'));
  const playoffRounds  = (tournament.rounds || []).filter(r => !['league','group_stage'].includes(r.round_type));
  const playoffNeedsSeeding = tournament.format === 'playoff'
    && leagueDone
    && playoffRounds.length > 0
    && playoffRounds[0]?.matches?.every(m => !m.team1_id);

  const hasFixtures    = (tournament.rounds || []).length > 0;
  const isCompleted    = tournament.status === 'completed';

  const SUB_TABS = [
    { id: 'fixtures',  label: '🏸 Fixtures' },
    { id: 'standings', label: '📊 Standings' },
    { id: 'bracket',   label: '🏆 Bracket' },
    { id: 'teams',     label: '🛡 Teams' },
  ];

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px' }}>

      {/* Back */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/tournaments')}
        className="mb-5"
      >
        ← Tournaments
      </Button>

      {/* ── Page header ── */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-5">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <h1
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 34, letterSpacing: 0.5, lineHeight: 1 }}
            >
              {tournament.name}
            </h1>
            <Badge
              label={(tournament.format || '').replace('_', ' ')}
              color={FORMAT_COLOR[tournament.format] || '#666'}
            />
            <Badge
              label={tournament.status}
              color={{ active: '#10B981', completed: '#F59E0B', draft: '#94A3B8' }[tournament.status] || '#94A3B8'}
            />
            {liveMatches > 0 && (
              <span className="animate-pulse text-xs font-black text-red-500">
                🔴 {liveMatches} LIVE
              </span>
            )}
          </div>
          <div className="text-sm text-slate-500">
            {tournament.tournament_teams?.length || 0} teams
            {' · '}Best of {tournament.sets_per_match || 3}
            {' · '}{tournament.points_per_set || 21} pts/set
            {tournament.num_groups > 1 && ` · ${tournament.num_groups} groups`}
            {tournament.format === 'playoff' && ` · Top ${tournament.playoff_teams} qualify`}
            {tournament.league_legs === 2 && ' · 🏠 Home & Away'}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          {!hasFixtures && (
            <Button
              variant="green"
              onClick={() => genMutation.mutate()}
              loading={genMutation.isLoading}
            >
              ⚡ Generate Fixtures
            </Button>
          )}
          {playoffNeedsSeeding && (
            <Button
              variant="purple"
              onClick={() => advanceMutation.mutate()}
              loading={advanceMutation.isLoading}
            >
              🏆 Seed Playoffs
            </Button>
          )}
          {isCompleted && (
            <Button
              variant="amber"
              onClick={() => exportTournamentPDF(tournament, standings)}
            >
              📄 Download PDF
            </Button>
          )}
          {hasFixtures && !isCompleted && (
            <Button
              variant="ghost"
              onClick={() => exportTournamentPDF(tournament, standings)}
            >
              📄 Export
            </Button>
          )}
        </div>
      </div>

      {/* ── Champion banner ── */}
      <ChampionBanner tournament={tournament} />

      {/* ── Progress bar ── */}
      {totalMatches > 0 && (
        <div className="mb-5">
          <ProgressBar
            value={playedMatches}
            max={totalMatches}
            color={FORMAT_COLOR[tournament.format] || '#3B82F6'}
          />
        </div>
      )}

      {/* ── Quick stats row ── */}
      <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
        {[
          { label: 'Teams',    value: tournament.tournament_teams?.length || 0, color: '#3B82F6' },
          { label: 'Rounds',   value: (tournament.rounds || []).length,          color: '#8B5CF6' },
          { label: 'Matches',  value: totalMatches,                              color: '#0F172A' },
          { label: 'Played',   value: playedMatches,                             color: '#10B981' },
          { label: 'Live',     value: liveMatches,                               color: '#EF4444' },
          { label: 'Remaining',value: totalMatches - playedMatches,              color: '#94A3B8' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-[#E2E8F0] rounded-xl p-3 text-center">
            <div
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 26, color: s.color, lineHeight: 1 }}
            >
              {s.value}
            </div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide mt-1 font-bold">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Sub-tabs ── */}
      <Tabs
        tabs={SUB_TABS}
        active={activeTab}
        onChange={setActiveTab}
      />

      {/* ── Tab content ── */}
      {activeTab === 'fixtures' && (
        <FixturesTab tournament={tournament} onMatchUpdate={handleMatchUpdate} />
      )}

      {activeTab === 'standings' && (
        <StandingsTable
          standings={standings}
          tournament={tournament}
          showQualifier={tournament.format === 'playoff'}
        />
      )}

      {activeTab === 'bracket' && (
        <BracketView rounds={tournament.rounds || []} />
      )}

      {activeTab === 'teams' && (
        <TeamsTab tournament={tournament} />
      )}
    </div>
  );
}
