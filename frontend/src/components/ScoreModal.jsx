import { useState } from 'react';
import { Modal, Button, TeamDot } from './ui';

export default function ScoreModal({ match, tournament, onSave, onClose }) {
  const maxSets   = tournament?.sets_per_match || 3;
  const setsToWin = Math.ceil(maxSets / 2);
  const ptTarget  = tournament?.points_per_set || 21;

  const [sets, setSets] = useState(() => {
    const existing = match.set_scores || [];
    return Array.from({ length: maxSets }, (_, i) => ({
      t1: existing[i]?.t1 ?? 0,
      t2: existing[i]?.t2 ?? 0,
    }));
  });

  // Derived state
  let t1Won = 0, t2Won = 0;
  for (const s of sets) {
    if (s.t1 > s.t2) t1Won++;
    else if (s.t2 > s.t1) t2Won++;
  }
  const matchFinished = t1Won >= setsToWin || t2Won >= setsToWin;
  // How many sets are "active" (already decided + one in progress)
  let activeSets = 0;
  let runT1 = 0, runT2 = 0;
  for (let i = 0; i < maxSets; i++) {
    activeSets = i + 1;
    const s = sets[i];
    if (s.t1 > s.t2) runT1++;
    else if (s.t2 > s.t1) runT2++;
    if (runT1 >= setsToWin || runT2 >= setsToWin) break;
  }

  const update = (setIdx, side, val) => {
    setSets(prev => {
      const next = prev.map((s, i) => i === setIdx ? { ...s, [side]: Math.max(0, parseInt(val) || 0) } : s);
      return next;
    });
  };

  const inc = (setIdx, side) => update(setIdx, side, (sets[setIdx][side] || 0) + 1);
  const dec = (setIdx, side) => update(setIdx, side, Math.max(0, (sets[setIdx][side] || 0) - 1));

  const handleSave = () => {
    const finalSets = sets.slice(0, activeSets);
    let ft1 = 0, ft2 = 0;
    for (const s of finalSets) {
      if (s.t1 > s.t2) ft1++;
      else if (s.t2 > s.t1) ft2++;
    }
    const winner = ft1 >= setsToWin ? match.team1_id : ft2 >= setsToWin ? match.team2_id : null;
    onSave({ set_scores: finalSets, status: winner ? 'completed' : 'ongoing' });
  };

  return (
    <Modal
      title={`Score Entry — Match #${match.match_number}`}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="dark" onClick={handleSave}>Save Score</Button>
        </>
      }
    >
      {/* Teams header */}
      <div className="flex justify-between items-center p-3 rounded-xl mb-5"
           style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
        <div className="flex items-center gap-2 flex-1">
          <TeamDot color={match.team1_color} size={12} />
          <span className="font-bold text-sm truncate max-w-[110px]">{match.team1_name}</span>
        </div>
        <div
          className="text-center px-4"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 30, minWidth: 80 }}
        >
          <span style={{ color: t1Won >= setsToWin ? '#10B981' : t2Won >= setsToWin ? '#EF4444' : '#0F172A' }}>{t1Won}</span>
          <span style={{ color: '#CBD5E1', fontWeight: 300 }}> – </span>
          <span style={{ color: t2Won >= setsToWin ? '#10B981' : t1Won >= setsToWin ? '#EF4444' : '#0F172A' }}>{t2Won}</span>
        </div>
        <div className="flex items-center gap-2 flex-1 justify-end">
          <span className="font-bold text-sm truncate max-w-[110px] text-right">{match.team2_name}</span>
          <TeamDot color={match.team2_color} size={12} />
        </div>
      </div>

      {/* Set rows */}
      {sets.map((s, i) => {
        const isActive = i < activeSets;
        const t1Winning = s.t1 > s.t2;
        const t2Winning = s.t2 > s.t1;
        return (
          <div
            key={i}
            className="mb-3 rounded-xl p-3 transition-opacity"
            style={{
              opacity: isActive ? 1 : 0.3,
              pointerEvents: isActive ? 'all' : 'none',
              background: isActive ? '#fff' : '#F8FAFC',
              border: `1px solid ${isActive ? '#E2E8F0' : '#F1F5F9'}`,
            }}
          >
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
              Set {i + 1}
            </div>
            <div className="grid grid-cols-[1fr_40px_1fr] gap-3 items-center">
              {/* Team 1 score control */}
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => inc(i, 't1')}
                  className="w-full h-7 rounded-md border-none cursor-pointer font-bold text-lg"
                  style={{ background: '#E2E8F0', color: '#475569' }}
                >▲</button>
                <input
                  type="number" min="0" max="99"
                  value={s.t1}
                  onChange={e => update(i, 't1', e.target.value)}
                  className="text-center font-black text-2xl py-2 rounded-lg"
                  style={{
                    border: `2px solid ${t1Winning ? '#10B981' : t2Winning ? '#EF4444' : '#E2E8F0'}`,
                    background: t1Winning ? '#F0FDF4' : t2Winning ? '#FFF1F2' : '#F8FAFC',
                    width: '100%',
                  }}
                />
                <button
                  onClick={() => dec(i, 't1')}
                  className="w-full h-7 rounded-md border-none cursor-pointer font-bold text-lg"
                  style={{ background: '#E2E8F0', color: '#475569' }}
                >▼</button>
              </div>

              <div className="text-center font-bold text-slate-400 text-xl">–</div>

              {/* Team 2 score control */}
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => inc(i, 't2')}
                  className="w-full h-7 rounded-md border-none cursor-pointer font-bold text-lg"
                  style={{ background: '#E2E8F0', color: '#475569' }}
                >▲</button>
                <input
                  type="number" min="0" max="99"
                  value={s.t2}
                  onChange={e => update(i, 't2', e.target.value)}
                  className="text-center font-black text-2xl py-2 rounded-lg"
                  style={{
                    border: `2px solid ${t2Winning ? '#10B981' : t1Winning ? '#EF4444' : '#E2E8F0'}`,
                    background: t2Winning ? '#F0FDF4' : t1Winning ? '#FFF1F2' : '#F8FAFC',
                    width: '100%',
                  }}
                />
                <button
                  onClick={() => dec(i, 't2')}
                  className="w-full h-7 rounded-md border-none cursor-pointer font-bold text-lg"
                  style={{ background: '#E2E8F0', color: '#475569' }}
                >▼</button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Winner announcement */}
      {matchFinished && (
        <div
          className="text-center font-bold text-sm rounded-lg py-2.5 mt-1"
          style={{
            background: t1Won >= setsToWin ? match.team1_color + '22' : match.team2_color + '22',
            color:      t1Won >= setsToWin ? match.team1_color : match.team2_color,
          }}
        >
          🏆 {t1Won >= setsToWin ? match.team1_name : match.team2_name} wins!
        </div>
      )}
    </Modal>
  );
}
