import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { getCourts, createCourt, updateCourt, deleteCourt } from '../utils/api';
import { PageHeader, Modal, Field, Button, IconButton, Badge, useConfirm } from '../components/ui';

function CourtForm({ court, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!court;
  const [form, setForm] = useState({
    name: '', location: '', surface_type: 'synthetic', is_available: true,
    ...(court || {}),
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation(
    isEdit ? data => updateCourt(court.id, data) : createCourt,
    {
      onSuccess: () => { qc.invalidateQueries('courts'); toast.success(isEdit ? 'Court updated' : 'Court added'); onClose(); },
      onError: err => toast.error(err.message),
    }
  );

  return (
    <Modal title={isEdit ? 'Edit Court' : 'New Court'} onClose={onClose} size="sm"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="dark" onClick={() => { if (!form.name?.trim()) return toast.error('Name required'); mutation.mutate(form); }} loading={mutation.isLoading}>
          {isEdit ? 'Update' : 'Add Court'}
        </Button>
      </>}
    >
      <Field label="Court Name" required>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Court 1" />
      </Field>
      <Field label="Location">
        <input value={form.location || ''} onChange={e => set('location', e.target.value)} placeholder="Main Hall, Annex..." />
      </Field>
      <Field label="Surface Type">
        <select value={form.surface_type} onChange={e => set('surface_type', e.target.value)}>
          {['synthetic', 'wooden', 'concrete', 'vinyl'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </Field>
      <Field label="">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
          <input
            type="checkbox"
            className="w-4 h-4"
            checked={form.is_available}
            onChange={e => set('is_available', e.target.checked)}
          />
          Available for booking
        </label>
      </Field>
    </Modal>
  );
}

export default function Courts() {
  const { data: courts = [], isLoading } = useQuery('courts', getCourts);
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const toggleMutation = useMutation(
    ({ id, is_available }) => updateCourt(id, { is_available }),
    { onSuccess: () => qc.invalidateQueries('courts'), onError: err => toast.error(err.message) }
  );
  const deleteMutation = useMutation(deleteCourt, {
    onSuccess: () => { qc.invalidateQueries('courts'); toast.success('Court removed'); },
    onError: err => toast.error(err.message),
  });

  const available = courts.filter(c => c.is_available).length;

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px' }}>
      {ConfirmDialog}
      <PageHeader title="Courts" subtitle={`${available}/${courts.length} available`} icon="🏸">
        <Button variant="dark" onClick={() => setEditing(false)}>+ Add Court</Button>
      </PageHeader>

      {editing !== null && <CourtForm court={editing || null} onClose={() => setEditing(null)} />}

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading courts...</div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
          {courts.map(court => (
            <div
              key={court.id}
              className="bg-white border border-[#E2E8F0] rounded-xl p-4"
              style={{ borderLeft: `4px solid ${court.is_available ? '#10B981' : '#EF4444'}` }}
            >
              <div
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20 }}
                className="mb-1"
              >
                🏸 {court.name}
              </div>
              {court.location && <div className="text-xs text-slate-500 mb-3">{court.location}</div>}
              <div className="flex gap-2 flex-wrap mb-4">
                <Badge label={court.surface_type} color="#64748B" bg="#F1F5F9" />
                <Badge
                  label={court.is_available ? 'Available' : 'Unavailable'}
                  color={court.is_available ? '#166534' : '#991B1B'}
                  bg={court.is_available ? '#DCFCE7' : '#FEE2E2'}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleMutation.mutate({ id: court.id, is_available: !court.is_available })}
                  className="flex-1 text-xs font-bold py-1.5 rounded-lg border-none cursor-pointer"
                  style={{
                    background: court.is_available ? '#FEE2E2' : '#DCFCE7',
                    color: court.is_available ? '#991B1B' : '#166534',
                  }}
                >
                  {court.is_available ? 'Mark Unavailable' : 'Mark Available'}
                </button>
                <IconButton onClick={() => setEditing(court)}>✏</IconButton>
                <IconButton danger onClick={async () => {
                  if (await confirm(`Remove "${court.name}"?`)) deleteMutation.mutate(court.id);
                }}>✕</IconButton>
              </div>
            </div>
          ))}
          {courts.length === 0 && (
            <div className="col-span-full text-center text-slate-400 py-10">No courts yet</div>
          )}
        </div>
      )}
    </div>
  );
}
