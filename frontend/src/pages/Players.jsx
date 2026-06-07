import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { getPlayers, createPlayer, updatePlayer, deletePlayer } from '../utils/api';
import { PageHeader, Modal, Field, Button, IconButton, Badge, Avatar, useConfirm } from '../components/ui';
import { SKILL_COLOR } from '../utils/fixtures';
import { clsx } from 'clsx';

const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'pro'];

function PlayerForm({ player, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!player;
  const [form, setForm] = useState({
    name: '', email: '', phone: '', skill_level: 'intermediate', photo_url: '',
    ...(player || {}),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation(
    isEdit ? data => updatePlayer(player.id, data) : createPlayer,
    {
      onSuccess: () => {
        qc.invalidateQueries('players');
        toast.success(isEdit ? 'Player updated' : 'Player added');
        onClose();
      },
      onError: err => toast.error(err.message),
    }
  );

  const save = () => {
    if (!form.name?.trim()) return toast.error('Name is required');
    mutation.mutate(form);
  };

  return (
    <Modal
      title={isEdit ? 'Edit Player' : 'Add New Player'}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="dark" onClick={save} loading={mutation.isLoading}>
            {isEdit ? 'Update' : 'Add Player'}
          </Button>
        </>
      }
    >
      <Field label="Name" required>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full name" />
      </Field>
      <Field label="Email">
        <input value={form.email || ''} onChange={e => set('email', e.target.value)} placeholder="email@club.in" type="email" />
      </Field>
      <Field label="Phone">
        <input value={form.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="+91 00000 00000" />
      </Field>
      <Field label="Photo URL">
        <input value={form.photo_url || ''} onChange={e => set('photo_url', e.target.value)} placeholder="https://..." />
      </Field>
      <Field label="Skill Level">
        <div className="grid grid-cols-4 gap-2">
          {SKILL_LEVELS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => set('skill_level', s)}
              className="py-2 rounded-lg text-xs font-bold border-none cursor-pointer transition-opacity capitalize"
              style={{
                background: form.skill_level === s ? SKILL_COLOR[s] : SKILL_COLOR[s] + '18',
                color: form.skill_level === s ? '#fff' : SKILL_COLOR[s],
                border: `1px solid ${SKILL_COLOR[s]}40`,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </Field>
    </Modal>
  );
}

export default function Players() {
  const { data: players = [], isLoading } = useQuery('players', getPlayers);
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null); // null=closed, false=new, {...}=edit
  const [filter, setFilter] = useState('');
  const { confirm, ConfirmDialog } = useConfirm();

  const deleteMutation = useMutation(deletePlayer, {
    onSuccess: () => { qc.invalidateQueries('players'); toast.success('Player removed'); },
    onError: err => toast.error(err.message),
  });

  const filtered = players.filter(p =>
    p.name.toLowerCase().includes(filter.toLowerCase()) ||
    (p.email || '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px' }}>
      {ConfirmDialog}
      <PageHeader title="Players" subtitle={`${players.length} registered players`} icon="👤">
        <input
          value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Search players..."
          className="text-sm rounded-lg px-3 py-2 border border-[#E2E8F0] w-48"
          style={{ background: '#fff' }}
        />
        <Button variant="dark" onClick={() => setEditing(false)}>+ Add Player</Button>
      </PageHeader>

      {editing !== null && (
        <PlayerForm player={editing || null} onClose={() => setEditing(null)} />
      )}

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading players...</div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))' }}>
          {filtered.map(p => (
            <div key={p.id} className="bg-white border border-[#E2E8F0] rounded-xl p-4">
              <div className="flex gap-3 items-start mb-3">
                <Avatar
                  name={p.name} photoUrl={p.photo_url} size={50}
                  color={SKILL_COLOR[p.skill_level]}
                  radius="50%"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-base text-slate-800 truncate">{p.name}</div>
                  {p.email && <div className="text-[11px] text-slate-400 truncate">{p.email}</div>}
                  {p.phone && <div className="text-[11px] text-slate-400">{p.phone}</div>}
                  <div className="flex gap-2 items-center mt-1.5 flex-wrap">
                    <Badge label={p.skill_level} color={SKILL_COLOR[p.skill_level]} />
                    <span className="text-xs text-slate-400">
                      W: <b style={{ color: '#10B981' }}>{p.wins || 0}</b>{' '}
                      L: <b style={{ color: '#EF4444' }}>{p.losses || 0}</b>
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <IconButton onClick={() => setEditing(p)}>✏</IconButton>
                <IconButton danger onClick={async () => {
                  if (await confirm(`Remove ${p.name}?`)) deleteMutation.mutate(p.id);
                }}>✕</IconButton>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-slate-400 py-10">No players found</div>
          )}
        </div>
      )}
    </div>
  );
}
