import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { getTeams, getPlayers, createTeam, updateTeam, deleteTeam, addTeamMember, removeTeamMember } from '../utils/api';
import { PageHeader, Modal, Field, Button, IconButton, Avatar, ColorField, useConfirm } from '../components/ui';
import { SKILL_COLOR } from '../utils/fixtures';

function TeamForm({ team, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!team;
  const [form, setForm] = useState({
    name: '', color: '#3B82F6', logo_url: '',
    ...(team || {}),
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation(
    isEdit ? data => updateTeam(team.id, data) : createTeam,
    {
      onSuccess: () => { qc.invalidateQueries('teams'); toast.success(isEdit ? 'Team updated' : 'Team created'); onClose(); },
      onError: err => toast.error(err.message),
    }
  );

  return (
    <Modal title={isEdit ? 'Edit Team' : 'New Team'} onClose={onClose} size="sm"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="dark" onClick={() => { if(!form.name?.trim()) return toast.error('Name required'); mutation.mutate(form); }} loading={mutation.isLoading}>
          {isEdit ? 'Update' : 'Create Team'}
        </Button>
      </>}
    >
      <Field label="Team Name" required>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Team name" />
      </Field>
      <Field label="Logo URL">
        <input value={form.logo_url || ''} onChange={e => set('logo_url', e.target.value)} placeholder="https://..." />
      </Field>
      <ColorField value={form.color || '#3B82F6'} onChange={v => set('color', v)} />
    </Modal>
  );
}

function MembersModal({ team, onClose }) {
  const qc = useQueryClient();
  const { data: players = [] } = useQuery('players', getPlayers);
  const [selPlayer, setSelPlayer] = useState('');
  const [selRole,   setSelRole]   = useState('player');

  const addMutation = useMutation(
    ({ playerId, role }) => addTeamMember(team.id, { player_id: playerId, role }),
    { onSuccess: () => { qc.invalidateQueries('teams'); toast.success('Player added'); setSelPlayer(''); }, onError: err => toast.error(err.message) }
  );
  const removeMutation = useMutation(
    playerId => removeTeamMember(team.id, playerId),
    { onSuccess: () => { qc.invalidateQueries('teams'); toast.success('Player removed'); }, onError: err => toast.error(err.message) }
  );

  const available = players.filter(p => !(team.members || []).find(m => m.id === p.id));

  return (
    <Modal title={`Members — ${team.name}`} onClose={onClose} size="md">
      <h3 className="font-bold text-sm text-slate-700 mb-3">Current Members ({(team.members || []).length})</h3>
      {(team.members || []).length === 0 && (
        <p className="text-slate-400 text-sm mb-4">No members yet.</p>
      )}
      {(team.members || []).map(m => (
        <div key={m.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl mb-2">
          <div className="flex items-center gap-3">
            <Avatar name={m.name} photoUrl={m.photo_url} size={36} color={SKILL_COLOR[m.skill_level]} radius="50%" />
            <div>
              <div className="font-semibold text-sm flex items-center gap-1.5">
                {m.name}
                {m.role === 'captain' && (
                  <span className="text-[9px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-bold uppercase">CAPT</span>
                )}
              </div>
              <div className="text-[11px] text-slate-400">{m.skill_level}</div>
            </div>
          </div>
          <IconButton danger onClick={() => removeMutation.mutate(m.id)}>✕</IconButton>
        </div>
      ))}

      <div className="border-t border-[#E2E8F0] mt-4 pt-4">
        <h3 className="font-bold text-sm text-slate-700 mb-3">Add Player</h3>
        <div className="flex gap-2">
          <select value={selPlayer} onChange={e => setSelPlayer(e.target.value)} style={{ flex: 2 }}>
            <option value="">Select player…</option>
            {available.map(p => <option key={p.id} value={p.id}>{p.name} ({p.skill_level})</option>)}
          </select>
          <select value={selRole} onChange={e => setSelRole(e.target.value)} style={{ flex: 1 }}>
            <option value="player">Player</option>
            <option value="captain">Captain</option>
          </select>
          <Button variant="dark" onClick={() => { if (!selPlayer) return toast.error('Select a player'); addMutation.mutate({ playerId: selPlayer, role: selRole }); }} loading={addMutation.isLoading}>
            Add
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function Teams() {
  const { data: teams = [], isLoading } = useQuery('teams', getTeams);
  const qc = useQueryClient();
  const [editing,  setEditing]  = useState(null);
  const [managing, setManaging] = useState(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const deleteMutation = useMutation(deleteTeam, {
    onSuccess: () => { qc.invalidateQueries('teams'); toast.success('Team removed'); },
    onError: err => toast.error(err.message),
  });

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px' }}>
      {ConfirmDialog}
      <PageHeader title="Teams" subtitle={`${teams.length} teams`} icon="🛡">
        <Button variant="dark" onClick={() => setEditing(false)}>+ Create Team</Button>
      </PageHeader>

      {editing !== null && <TeamForm team={editing || null} onClose={() => setEditing(null)} />}
      {managing && <MembersModal team={managing} onClose={() => setManaging(null)} />}

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading teams...</div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))' }}>
          {teams.map(team => (
            <div key={team.id} className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
              {/* Header */}
              <div
                className="flex gap-3 items-center p-4"
                style={{ background: team.color + '14', borderBottom: `3px solid ${team.color}` }}
              >
                <Avatar
                  name={team.name} photoUrl={team.logo_url} size={48}
                  color={team.color} radius="10px"
                />
                <div className="flex-1 min-w-0">
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 17 }} className="truncate">
                    {team.name}
                  </div>
                  <div className="text-[11px] text-slate-500">{(team.members || []).length} players</div>
                </div>
              </div>

              {/* Members preview */}
              <div className="px-4 py-3">
                {(team.members || []).slice(0, 4).map(m => (
                  <div key={m.id} className="flex items-center gap-2 py-1">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-slate-500 flex-shrink-0"
                      style={{ background: '#E2E8F0' }}
                    >
                      {m.name?.charAt(0)}
                    </div>
                    <span className={`text-[13px] ${m.role === 'captain' ? 'font-bold' : ''}`}>{m.name}</span>
                    {m.role === 'captain' && (
                      <span className="text-[9px] bg-yellow-100 text-yellow-800 px-1.5 rounded font-bold uppercase ml-0.5">C</span>
                    )}
                  </div>
                ))}
                {(team.members || []).length > 4 && (
                  <div className="text-[11px] text-slate-400 pt-1">+{team.members.length - 4} more</div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setManaging(team)}
                    className="flex-1 text-xs font-bold py-1.5 rounded-lg border cursor-pointer"
                    style={{ background: team.color + '12', color: team.color, borderColor: team.color + '40' }}
                  >
                    Manage Members
                  </button>
                  <IconButton onClick={() => setEditing(team)}>✏</IconButton>
                  <IconButton danger onClick={async () => {
                    if (await confirm(`Remove team "${team.name}"?`)) deleteMutation.mutate(team.id);
                  }}>✕</IconButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
