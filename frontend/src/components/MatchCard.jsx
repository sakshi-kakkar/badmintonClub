import { useState } from 'react';
import { Badge, TeamDot } from './ui';
import { STATUS_COLOR } from '../utils/fixtures';
import ScoreModal from './ScoreModal';

export default function MatchCard({ match, tournament, onUpdate }) {
  const [showScore, setShowScore] = useState(false);

  const isPending  = !match.team1_id || !match.team2_id;
  const isWalkover = match.status === 'walkover';

  const cardBg = {
    scheduled: '#fff',
    ongoing:   '#FFFBEB',
    completed: '#F0FDF4',
    walkover:  '#F8FAFC',
  }[match.status] || '#fff';

  const cardBorder = {
    scheduled: '#E2E8F0',
    ongoing:   '#FCD34D',
    completed: '#6EE7B7',
    walkover:  '#E2E8F0',
  }[match.status] || '#E2E8F0';

  const handleSetStatus = (status) => {
    onUpdate?.(match.id, { status });
  };

  const handleSaveScore = (scoreData) => {
    onUpdate?.(match.id, scoreData);
    setShowScore(false);
  };

  return (
    <>
      <div
        className="rounded-xl p-3.5 transition-shadow hover:shadow-md"
        style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderLeft: `3px solid ${STATUS_COLOR[match.status]}` }}
      >
        {/* Header row */}
        <div className="flex justify-between items-center mb-2">
          <span className="text-[11px] text-slate-400 font-semibold">
            #{match.match_number}
            {match.court_name && <span className="ml-1 text-slate-400"> · {match.court_name}</span>}
            {tournament?.league_legs === 2 && match.leg_number === 1 && (
              <span
                className="ml-1.5 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold"
                style={{ background: '#F0FDF4', color: '#15803D' }}
              >
                🏠 Home
              </span>
            )}
            {tournament?.league_legs === 2 && match.leg_number === 2 && (
              <span
                className="ml-1.5 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold"
                style={{ background: '#EFF6FF', color: '#1D4ED8' }}
              >
                ✈ Away
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            {match.status === 'ongoing' && (
              <span className="animate-pulse text-[10px] font-bold" style={{ color: '#F59E0B' }}>● LIVE</span>
            )}
            <Badge
              label={match.status}
              color={STATUS_COLOR[match.status]}
            />
          </div>
        </div>

        {/* Teams & score */}
        <div className="flex items-center gap-2">
          {/* Team 1 */}
          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            <TeamDot color={match.team1_color} size={10} />
            <span
              className="text-[13px] truncate"
              style={{
                fontWeight: match.winner_team_id === match.team1_id ? 800 : 600,
                color: match.winner_team_id && match.winner_team_id !== match.team1_id ? '#94A3B8' : '#0F172A',
              }}
            >
              {match.team1_name || 'TBD'}
            </span>
            {match.winner_team_id === match.team1_id && <span className="text-sm ml-0.5">🏆</span>}
          </div>

          {/* Score / VS */}
          <div className="text-center min-w-[64px]">
            {match.status === 'completed' || match.status === 'ongoing' ? (
              <div
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, lineHeight: 1 }}
              >
                <span style={{ color: match.winner_team_id === match.team1_id ? '#10B981' : match.winner_team_id ? '#EF4444' : '#0F172A' }}>
                  {match.team1_score}
                </span>
                <span style={{ color: '#CBD5E1', fontWeight: 300 }}> – </span>
                <span style={{ color: match.winner_team_id === match.team2_id ? '#10B981' : match.winner_team_id ? '#EF4444' : '#0F172A' }}>
                  {match.team2_score}
                </span>
              </div>
            ) : (
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, color: '#CBD5E1' }}>
                VS
              </div>
            )}
          </div>

          {/* Team 2 */}
          <div className="flex-1 flex items-center gap-1.5 justify-end min-w-0">
            {match.winner_team_id === match.team2_id && <span className="text-sm mr-0.5">🏆</span>}
            <span
              className="text-[13px] truncate text-right"
              style={{
                fontWeight: match.winner_team_id === match.team2_id ? 800 : 600,
                color: match.winner_team_id && match.winner_team_id !== match.team2_id ? '#94A3B8' : '#0F172A',
              }}
            >
              {match.team2_name || 'TBD'}
            </span>
            <TeamDot color={match.team2_color} size={10} />
          </div>
        </div>

        {/* Set scores breakdown */}
        {(match.set_scores || []).length > 0 && (
          <div className="flex gap-1.5 flex-wrap justify-center mt-2">
            {match.set_scores.map((s, i) => (
              <span
                key={i}
                className="text-[10px] rounded px-1.5 py-0.5"
                style={{ background: '#F1F5F9', color: '#64748B' }}
              >
                S{i + 1}: {s.t1}–{s.t2}
              </span>
            ))}
          </div>
        )}

        {/* Notes */}
        {match.notes && (
          <p className="text-[11px] text-slate-400 mt-2 italic">{match.notes}</p>
        )}

        {/* Action buttons */}
        {!isPending && !isWalkover && (
          <div className="flex gap-1.5 mt-3">
            {match.status === 'scheduled' && (
              <button
                onClick={() => handleSetStatus('ongoing')}
                className="flex-1 rounded-lg font-bold text-[11px] py-1.5 border-none cursor-pointer uppercase tracking-wide"
                style={{ background: '#FEF9C3', color: '#92400E', border: '1px solid #FCD34D' }}
              >
                ▶ Start
              </button>
            )}
            {match.status === 'ongoing' && (
              <button
                onClick={() => handleSetStatus('scheduled')}
                className="rounded-lg font-bold text-[11px] py-1.5 px-3 border-none cursor-pointer uppercase tracking-wide"
                style={{ background: '#FEE2E2', color: '#991B1B' }}
              >
                ⏹ Reset
              </button>
            )}
            <button
              onClick={() => setShowScore(true)}
              className="flex-[2] rounded-lg font-bold text-[11px] py-1.5 text-white border-none cursor-pointer uppercase tracking-wide"
              style={{ background: '#0F172A' }}
            >
              {match.status === 'completed' ? '✏ Edit Score' : '🎯 Enter Score'}
            </button>
          </div>
        )}
      </div>

      {showScore && (
        <ScoreModal
          match={match}
          tournament={tournament}
          onSave={handleSaveScore}
          onClose={() => setShowScore(false)}
        />
      )}
    </>
  );
}
