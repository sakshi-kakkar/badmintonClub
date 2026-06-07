import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  getTournaments, getTeams, getCourts,
  createTournament, deleteTournament, addTournamentTeams,
} from '../utils/api';
import {
  PageHeader, Button, IconButton, Badge,
  EmptyState, ProgressBar, Stepper, Field,
  Modal, useConfirm, TeamDot, Avatar,
} from '../components/ui';
import { FORMAT_COLOR } from '../utils/fixtures';

// ── Wizard steps ────────────────────────────────────────────────────────────
const STEPS = ['Details', 'Select Teams', 'Assign Courts'];

const FORMAT_OPTIONS = [
  { value: 'round_robin', icon: '🔄', label: 'Round Robin',  desc: 'Every team plays each other' },
  { value: 'knockout',    icon: '⚡', label: 'Knockout',     desc: 'Single elimination bracket' },
  { value: 'playoff',     icon: '🏆', label: 'Playoff (IPL)', desc: 'Group stage + knockout' },
];

const STATUS_COLOR = {
  draft:     '#94A3B8',
  active:    '#10B981',
  completed: '#F59E0B',
  cancelled: '#EF4444',
};

function TournamentWizard({ onClose }) {
  const qc       = useQueryClient();
  const navigate = useNavigate();
  const { data: teams  = [] } = useQuery('teams',  getTeams);
  const { data: courts = [] } = useQuery('courts', getCourts);

  const [step,      setStep]      = useState(1);
  const [selTeams,  setSelTeams]  = useState([]);
  const [selCourts, setSelCourts] = useState([]);
  const [form, setForm] = useState({
    name: '', format: 'playoff', num_groups: 2,
    playoff_teams: 4, sets_per_match: 3, points_per_set: 21, description: '',
    league_legs: 1,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const createMutation = useMutation(
    async () => {
      const t = await createTournament({ ...form, court_ids: selCourts });
      // assign teams (group distribution handled server-side)
      await addTournamentTeams(t.id, { team_ids: selTeams });
      return t;
    },
    {
      onSuccess: (t) => {
        qc.invalidateQueries('tournaments');
        toast.success('Tournament created! Generate fixtures to begin.');
        onClose();
        navigate(`/tournaments/${t.id}`);
      },
      onError: err => toast.error(err.message),
    }
  );

  const next = () => {
    if (step === 1) {
      if (!form.name?.trim()) return toast.error('Tournament name is required');
      setStep(2);
    } else if (step === 2) {
      if (selTeams.length < 2) return toast.error('Select at least 2 teams');
      setStep(3);
    } else {
      createMutation.mutate();
    }
  };

  const availCourts = courts.filter(c => c.is_available);

  // Group preview
  const GROUPS = 'ABCDEFGHIJ'.split('');
  const groupPreview = {};
  if (form.num_groups > 1 && form.format !== 'knockout') {
    selTeams.forEach((tid, i) => {
      const g = GROUPS[i % form.num_groups];
      if (!groupPreview[g]) groupPreview[g] = [];
      groupPreview[g].push(teams.find(t => t.id === tid));
    });
  }

  return (
    <Modal
      title="New Tournament"
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex justify-between w-full">
          <Button variant="ghost" onClick={step > 1 ? () => setStep(s => s - 1) : onClose}>
            {step > 1 ? '← Back' : 'Cancel'}
          </Button>
          <Button
            variant={step === 3 ? 'green' : 'dark'}
            onClick={next}
            loading={createMutation.isLoading}
          >
            {step === 3 ? '🏸 Create Tournament' : 'Next →'}
          </Button>
        </div>
      }
    >
      <Stepper steps={STEPS} current={step} />

      {/* ── Step 1: Details ── */}
      {step === 1 && (
        <div>
          <Field label="Tournament Name" required>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Summer Open 2025"
              autoFocus
            />
          </Field>

          <Field label="Format">
            <div className="grid grid-cols-3 gap-3 mb-1">
              {FORMAT_OPTIONS.map(f => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => set('format', f.value)}
                  className="p-3 rounded-xl border-2 cursor-pointer text-left transition-all"
                  style={{
                    borderColor: form.format === f.value ? FORMAT_COLOR[f.value] : '#E2E8F0',
                    background:  form.format === f.value ? FORMAT_COLOR[f.value] + '12' : '#F8FAFC',
                  }}
                >
                  <div className="text-xl mb-1">{f.icon}</div>
                  <div className="font-bold text-sm text-slate-800">{f.label}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{f.desc}</div>
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            {form.format !== 'knockout' && (
              <Field label="Number of Groups">
                <select value={form.num_groups} onChange={e => set('num_groups', parseInt(e.target.value))}>
                  {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} Group{n > 1 ? 's' : ''}</option>)}
                </select>
              </Field>
            )}
            {form.format === 'playoff' && (
              <Field label="Playoff Qualifiers">
                <select value={form.playoff_teams} onChange={e => set('playoff_teams', parseInt(e.target.value))}>
                  {[4, 8, 16].map(n => <option key={n} value={n}>Top {n} teams</option>)}
                </select>
              </Field>
            )}
          </div>

          {/* League legs — only for round_robin and playoff group stages */}
          {form.format !== 'knockout' && (
            <Field label="League Legs" hint="Home &amp; Away plays each pair twice, swapping home side">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 1, icon: '🔁', label: 'Single Leg',    desc: 'Each pair plays once' },
                  { value: 2, icon: '🏠', label: 'Home & Away',   desc: 'Each pair plays twice' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set('league_legs', opt.value)}
                    className="p-3 rounded-xl border-2 cursor-pointer text-left transition-all"
                    style={{
                      borderColor: form.league_legs === opt.value ? '#10B981' : '#E2E8F0',
                      background:  form.league_legs === opt.value ? '#F0FDF4'  : '#F8FAFC',
                    }}
                  >
                    <div className="text-xl mb-1">{opt.icon}</div>
                    <div className="font-bold text-sm text-slate-800">{opt.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Sets Per Match">
              <select value={form.sets_per_match} onChange={e => set('sets_per_match', parseInt(e.target.value))}>
                <option value={1}>Best of 1</option>
                <option value={3}>Best of 3</option>
                <option value={5}>Best of 5</option>
              </select>
            </Field>
            <Field label="Points Per Set">
              <select value={form.points_per_set} onChange={e => set('points_per_set', parseInt(e.target.value))}>
                {[11, 15, 21, 25, 30].map(n => <option key={n} value={n}>{n} pts</option>)}
              </select>
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Optional tournament description..."
            />
          </Field>
        </div>
      )}

      {/* ── Step 2: Teams ── */}
      {step === 2 && (
        <div>
          <div className="text-sm text-slate-500 mb-3">
            Selected: <strong className="text-slate-800">{selTeams.length}</strong> team{selTeams.length !== 1 ? 's' : ''}
            {form.num_groups > 1 && form.format !== 'knockout' &&
              ` · ${form.num_groups} groups · ~${Math.ceil(selTeams.length / form.num_groups)} per group`}
          </div>

          <div
            className="grid gap-2 mb-4 overflow-y-auto"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', maxHeight: 360 }}
          >
            {teams.map(t => {
              const selected = selTeams.includes(t.id);
              return (
                <div
                  key={t.id}
                  onClick={() => setSelTeams(selected
                    ? selTeams.filter(id => id !== t.id)
                    : [...selTeams, t.id]
                  )}
                  className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all"
                  style={{
                    borderColor: selected ? t.color : '#E2E8F0',
                    background:  selected ? t.color + '12' : '#F8FAFC',
                  }}
                >
                  <Avatar name={t.name} photoUrl={t.logo_url} color={t.color} size={34} radius="8px" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{t.name}</div>
                    <div className="text-[11px] text-slate-400">{t.members?.length || 0} players</div>
                  </div>
                  {selected && <span style={{ color: t.color, fontSize: 18 }}>✓</span>}
                </div>
              );
            })}
            {teams.length === 0 && (
              <div className="col-span-full text-slate-400 text-sm text-center py-8">
                No teams found. Create teams first.
              </div>
            )}
          </div>

          {/* Group distribution preview */}
          {Object.keys(groupPreview).length > 1 && (
            <div className="rounded-xl p-3 border border-[#E2E8F0] bg-slate-50">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Group Distribution Preview
              </div>
              <div className="flex gap-4 flex-wrap">
                {Object.entries(groupPreview).map(([g, gTeams]) => (
                  <div key={g}>
                    <div
                      className="text-xs font-bold mb-1"
                      style={{ color: FORMAT_COLOR[form.format] }}
                    >
                      Group {g}
                    </div>
                    {gTeams.filter(Boolean).map(t => (
                      <div key={t.id} className="flex items-center gap-1.5 text-xs text-slate-700 mb-0.5">
                        <TeamDot color={t.color} size={7} />
                        {t.name}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Courts ── */}
      {step === 3 && (
        <div>
          <p className="text-sm text-slate-500 mb-4">
            Assign courts for parallel match scheduling.
            Matches will be distributed across selected courts automatically.
            <span className="font-semibold text-slate-700"> (Optional)</span>
          </p>

          {availCourts.length === 0 ? (
            <div className="text-slate-400 text-sm text-center py-6 bg-slate-50 rounded-xl border border-[#E2E8F0]">
              No available courts. You can add courts in the Courts section.
            </div>
          ) : (
            <div
              className="grid gap-2 mb-4"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
            >
              {availCourts.map(c => {
                const selected = selCourts.includes(c.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelCourts(selected
                      ? selCourts.filter(id => id !== c.id)
                      : [...selCourts, c.id]
                    )}
                    className="p-3 rounded-xl border-2 cursor-pointer transition-all"
                    style={{
                      borderColor: selected ? '#10B981' : '#E2E8F0',
                      background:  selected ? '#F0FDF4' : '#F8FAFC',
                    }}
                  >
                    <div className="font-bold text-sm">🏸 {c.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {c.location} · {c.surface_type}
                    </div>
                    {selected && (
                      <div className="text-[11px] font-bold text-green-700 mt-1">Selected ✓</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary */}
          <div className="rounded-xl p-4 bg-slate-50 border border-[#E2E8F0] text-sm">
            <div className="font-bold text-slate-700 mb-2">Tournament Summary</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-slate-600">
              <span>Name:</span>           <strong>{form.name}</strong>
              <span>Format:</span>         <strong>{form.format.replace('_', ' ')}</strong>
              <span>Teams:</span>          <strong>{selTeams.length}</strong>
              {form.format !== 'knockout' && <><span>Groups:</span><strong>{form.num_groups}</strong></>}
              {form.format === 'playoff'  && <><span>Playoff teams:</span><strong>Top {form.playoff_teams}</strong></>}
              {form.format !== 'knockout' && <><span>League legs:</span><strong>{form.league_legs === 2 ? '🏠 Home & Away' : '🔁 Single Leg'}</strong></>}
              <span>Sets per match:</span> <strong>Best of {form.sets_per_match}</strong>
              <span>Points per set:</span> <strong>{form.points_per_set} pts</strong>
              <span>Courts:</span>         <strong>{selCourts.length || 'Any available'}</strong>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Tournament Card ─────────────────────────────────────────────────────────
function TournamentCard({ tournament, onDelete }) {
  const navigate = useNavigate();
  const allM  = (tournament.rounds || []).flatMap(r => r.matches || []);
  const done  = allM.filter(m => m.status === 'completed').length;
  const live  = allM.filter(m => m.status === 'ongoing').length;

  return (
    <div
      className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/tournaments/${tournament.id}`)}
    >
      {/* Header */}
      <div className="p-4 pb-3 border-b border-[#F1F5F9]">
        <div className="flex justify-between items-start gap-2">
          <div
            className="font-black text-slate-800 leading-tight flex-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18 }}
          >
            {tournament.name}
          </div>
          {tournament.status === 'completed' && <span className="text-2xl">🏆</span>}
          {live > 0 && (
            <span className="animate-pulse text-[10px] font-black text-red-500 flex-shrink-0">🔴 LIVE</span>
          )}
        </div>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          <Badge
            label={(tournament.format || '').replace('_', ' ')}
            color={FORMAT_COLOR[tournament.format] || '#666'}
          />
          <Badge
            label={tournament.status}
            color={STATUS_COLOR[tournament.status] || '#666'}
          />
          {tournament.num_groups > 1 && (
            <Badge label={`${tournament.num_groups} groups`} color="#64748B" bg="#F1F5F9" />
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-3">
        <div className="flex gap-4 mb-3">
          {[
            { label: 'Teams',   value: tournament.tournament_teams?.length || tournament.team_count || 0 },
            { label: 'Matches', value: allM.length || tournament.match_count || 0 },
            { label: 'Played',  value: done || tournament.completed_matches || 0, color: '#10B981' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 24, color: s.color || '#0F172A', lineHeight: 1 }}
              >
                {s.value}
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">{s.label}</div>
            </div>
          ))}
          {tournament.winner_name && (
            <div className="ml-auto text-right">
              <div className="font-bold text-sm text-slate-800">{tournament.winner_name}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">Champion</div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {(allM.length > 0 || tournament.match_count > 0) && (
          <ProgressBar
            value={done || tournament.completed_matches || 0}
            max={allM.length || tournament.match_count || 1}
            color={FORMAT_COLOR[tournament.format] || '#3B82F6'}
          />
        )}
      </div>

      {/* Footer */}
      <div
        className="flex justify-end px-4 pb-3"
        onClick={e => e.stopPropagation()}
      >
        <IconButton danger onClick={() => onDelete(tournament)}>✕</IconButton>
      </div>
    </div>
  );
}

// ── Tournaments List Page ───────────────────────────────────────────────────
export default function Tournaments() {
  const { data: tournaments = [], isLoading } = useQuery('tournaments', getTournaments, {
    refetchInterval: 10000,
  });
  const qc = useQueryClient();
  const [showWizard, setShowWizard] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const { confirm, ConfirmDialog } = useConfirm();

  const deleteMutation = useMutation(deleteTournament, {
    onSuccess: () => { qc.invalidateQueries('tournaments'); toast.success('Tournament deleted'); },
    onError:   err => toast.error(err.message),
  });

  const handleDelete = async (t) => {
    if (await confirm(`Delete "${t.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(t.id);
    }
  };

  const filtered = filterStatus === 'all'
    ? tournaments
    : tournaments.filter(t => t.status === filterStatus);

  const counts = {
    all:       tournaments.length,
    draft:     tournaments.filter(t => t.status === 'draft').length,
    active:    tournaments.filter(t => t.status === 'active').length,
    completed: tournaments.filter(t => t.status === 'completed').length,
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px' }}>
      {ConfirmDialog}

      <PageHeader
        title="Tournaments"
        subtitle={`${tournaments.length} total`}
        icon="🏆"
      >
        <Button variant="dark" onClick={() => setShowWizard(true)}>+ New Tournament</Button>
      </PageHeader>

      {showWizard && <TournamentWizard onClose={() => setShowWizard(false)} />}

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-5 flex-wrap">
        {[
          { key: 'all',       label: 'All' },
          { key: 'active',    label: 'Active' },
          { key: 'draft',     label: 'Draft' },
          { key: 'completed', label: 'Completed' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            className="px-4 py-1.5 rounded-lg text-xs font-bold border-none cursor-pointer transition-all"
            style={{
              background: filterStatus === f.key ? '#0F172A' : '#fff',
              color:      filterStatus === f.key ? '#fff' : '#64748B',
              border: `1px solid ${filterStatus === f.key ? '#0F172A' : '#E2E8F0'}`,
            }}
          >
            {f.label}
            <span className="ml-1.5 opacity-60">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading tournaments...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🏆"
          title={filterStatus === 'all' ? 'No tournaments yet' : `No ${filterStatus} tournaments`}
          subtitle={filterStatus === 'all' ? 'Create your first tournament to get started' : undefined}
          action={
            filterStatus === 'all'
              ? <Button variant="dark" onClick={() => setShowWizard(true)}>+ Create Tournament</Button>
              : undefined
          }
        />
      ) : (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
        >
          {filtered.map(t => (
            <TournamentCard key={t.id} tournament={t} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
