import { TeamDot } from './ui';
import { ROUND_LABEL } from '../utils/fixtures';

export default function BracketView({ rounds = [] }) {
  const koRounds = rounds.filter(r => !['league', 'group_stage'].includes(r.round_type));

  if (!koRounds.length) {
    return (
      <div className="rounded-xl bg-white border border-[#E2E8F0] p-10 text-center text-slate-400 text-sm">
        Bracket view is available for knockout and playoff formats after fixtures are generated.
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto pb-4">
        <div
          className="flex gap-6 items-stretch"
          style={{ minWidth: koRounds.length * 210 + 'px', alignItems: 'flex-start' }}
        >
          {koRounds.map((round, ri) => (
            <div key={round.id} className="flex flex-col flex-1 min-w-[190px]">
              {/* Round label */}
              <div
                className="text-center text-[11px] font-bold uppercase tracking-wider mb-3 pb-2 border-b border-[#E2E8F0]"
                style={{ color: '#64748B' }}
              >
                {ROUND_LABEL[round.round_type] || round.round_type}
              </div>

              {/* Matches, spaced vertically to align with bracket structure */}
              <div
                className="flex flex-col"
                style={{
                  gap: ri === 0 ? 10 : Math.pow(2, ri) * 10 + (Math.pow(2, ri) - 1) * 10,
                  paddingTop: ri === 0 ? 0 : (Math.pow(2, ri - 1) - 0.5) * 10,
                }}
              >
                {(round.matches || []).map(m => (
                  <BracketMatch key={m.id} match={m} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-5 mt-4 text-[11px] text-slate-400">
        {[['#10B981','Winner'],['#EF4444','Eliminated'],['#94A3B8','TBD / Pending']].map(([color, label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <TeamDot color={color} size={9} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketMatch({ match }) {
  const teams = [
    { id: match.team1_id, name: match.team1_name, color: match.team1_color, score: match.team1_score },
    { id: match.team2_id, name: match.team2_name, color: match.team2_color, score: match.team2_score },
  ];

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid #E2E8F0', background: '#fff', minWidth: 180 }}
    >
      {teams.map((t, i) => {
        const isWinner   = match.winner_team_id && match.winner_team_id === t.id;
        const isEliminated = match.winner_team_id && match.winner_team_id !== t.id;
        return (
          <div
            key={i}
            className="flex items-center justify-between px-2.5 py-2"
            style={{
              borderBottom: i === 0 ? '1px solid #F1F5F9' : 'none',
              background: isWinner ? '#F0FDF4' : 'transparent',
            }}
          >
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <TeamDot color={t.color || '#94A3B8'} size={8} />
              <span
                className="text-xs truncate"
                style={{
                  fontWeight: isWinner ? 700 : 500,
                  color: isEliminated ? '#94A3B8' : isWinner ? '#065F46' : '#0F172A',
                }}
              >
                {t.name || 'TBD'}
              </span>
            </div>
            {match.status === 'completed' && (
              <span
                className="text-sm font-black ml-2 flex-shrink-0"
                style={{ color: isWinner ? '#10B981' : '#EF4444' }}
              >
                {t.score}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
