import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';

// ─── Button ────────────────────────────────────────────────────────────────
export function Button({ children, variant = 'dark', size = 'md', className, loading, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 font-bold uppercase tracking-wide rounded-lg border-none cursor-pointer transition-opacity hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    dark:   'bg-[#0F172A] text-white',
    green:  'bg-[#10B981] text-white',
    red:    'bg-[#EF4444] text-white',
    amber:  'bg-[#F59E0B] text-white',
    purple: 'bg-[#8B5CF6] text-white',
    blue:   'bg-[#3B82F6] text-white',
    ghost:  'bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]',
    cyan:   'bg-[#22D3EE] text-[#0F172A]',
  };
  const sizes = {
    xs: 'text-[10px] px-2.5 py-1',
    sm: 'text-[11px] px-3 py-1.5',
    md: 'text-[12px] px-4 py-2',
    lg: 'text-[13px] px-5 py-2.5',
  };
  return (
    <button
      style={{ fontFamily: "'Barlow', sans-serif" }}
      className={clsx(base, variants[variant], sizes[size], className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : children}
    </button>
  );
}

// ─── Icon Button ───────────────────────────────────────────────────────────
export function IconButton({ children, danger, success, className, ...props }) {
  return (
    <button
      className={clsx(
        'w-8 h-8 rounded-md flex items-center justify-center font-bold text-sm border-none cursor-pointer transition-opacity hover:opacity-80',
        danger  ? 'bg-red-100 text-red-600' :
        success ? 'bg-green-100 text-green-700' :
                  'bg-slate-100 text-slate-500',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────
export function Badge({ label, color, bg, className }) {
  return (
    <span
      className={clsx('inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide', className)}
      style={{ background: bg || color + '22', color }}
    >
      {label}
    </span>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────
export function Card({ children, className, style }) {
  return (
    <div
      className={clsx('bg-white border border-[#E2E8F0] rounded-xl', className)}
      style={style}
    >
      {children}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, size = 'md', footer }) {
  const sizeMap = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };
  // close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
      onClick={e => e.target === e.currentTarget && onClose?.()}
    >
      <div className={clsx('w-full bg-white rounded-2xl shadow-2xl animate-fade-in-down max-h-[92vh] flex flex-col', sizeMap[size])}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] flex-shrink-0">
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: 0.3 }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 border-none cursor-pointer text-lg font-semibold"
          >
            ✕
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
        {/* Footer */}
        {footer && <div className="border-t border-[#E2E8F0] px-6 py-4 flex justify-end gap-3 flex-shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

// ─── Form Field ───────────────────────────────────────────────────────────
export function Field({ label, required, hint, children, className }) {
  return (
    <div className={clsx('mb-3.5', className)}>
      {label && (
        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

// ─── Page Header ──────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, icon, children }) {
  return (
    <div className="flex justify-between items-end mb-6">
      <div>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 34, letterSpacing: 0.5, color: '#0F172A', lineHeight: 1 }}>
          {icon && <span className="mr-2">{icon}</span>}{title}
        </h1>
        {subtitle && <p className="text-slate-500 mt-1 text-sm">{subtitle}</p>}
      </div>
      {children && <div className="flex gap-2 items-center">{children}</div>}
    </div>
  );
}

// ─── Team Dot ─────────────────────────────────────────────────────────────
export function TeamDot({ color, size = 10 }) {
  return (
    <span
      className="inline-block rounded-full flex-shrink-0"
      style={{ width: size, height: size, background: color }}
    />
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────
export function Avatar({ name, photoUrl, color, size = 40, radius = '50%' }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: radius,
        background: photoUrl ? `url(${photoUrl}) center/cover` : (color || '#E2E8F0'),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 900, fontSize: size / 2.4, color: '#fff', flexShrink: 0, overflow: 'hidden',
      }}
    >
      {!photoUrl && (name?.charAt(0) || '?')}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────
export function StatCard({ icon, value, label, accent }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-4" style={{ borderTop: `3px solid ${accent}` }}>
      <div className="text-2xl mb-1">{icon}</div>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 36, lineHeight: 1, color: accent }}>
        {value}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">{label}</div>
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────
export function ProgressBar({ value, max, color = '#3B82F6' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
        <span>{value}/{max} matches</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: pct + '%', background: pct === 100 ? '#10B981' : color }}
        />
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────
export function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl text-center p-16">
      <div className="text-5xl mb-4">{icon}</div>
      <h2 className="font-extrabold text-lg text-slate-800 mb-2">{title}</h2>
      {subtitle && <p className="text-slate-500 text-sm mb-5">{subtitle}</p>}
      {action}
    </div>
  );
}

// ─── Loading Spinner ──────────────────────────────────────────────────────
export function Spinner({ size = 24 }) {
  return (
    <div
      className="animate-spin rounded-full border-2 border-slate-200 border-t-[#0F172A]"
      style={{ width: size, height: size }}
    />
  );
}

// ─── Tabs ──────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex border-b border-[#E2E8F0] mb-5">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{ fontFamily: "'Barlow', sans-serif" }}
          className={clsx(
            'px-5 py-2.5 text-sm font-semibold border-none cursor-pointer tracking-wide bg-transparent border-b-2 transition-colors',
            active === t.id
              ? 'text-slate-900 border-b-[#0F172A]'
              : 'text-slate-500 border-transparent hover:text-slate-700'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────
export function useConfirm() {
  const [state, setState] = useState(null);
  const confirm = (message) => new Promise(resolve => setState({ message, resolve }));
  const ConfirmDialog = state ? (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-fade-in-down">
        <p className="text-slate-800 font-semibold text-base mb-6">{state.message}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={() => { state.resolve(false); setState(null); }}>Cancel</Button>
          <Button variant="red" onClick={() => { state.resolve(true);  setState(null); }}>Confirm</Button>
        </div>
      </div>
    </div>
  ) : null;
  return { confirm, ConfirmDialog };
}

// ─── Stepper ──────────────────────────────────────────────────────────────
export function Stepper({ steps, current }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((label, i) => {
        const num = i + 1;
        const done = current > num;
        const active = current === num;
        return (
          <div key={label} className="flex items-center flex-1">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                style={{
                  background: done ? '#10B981' : active ? '#0F172A' : '#E2E8F0',
                  color: done || active ? '#fff' : '#94A3B8',
                }}
              >
                {done ? '✓' : num}
              </div>
              <span className={clsx('text-xs font-semibold whitespace-nowrap', active ? 'text-slate-900' : 'text-slate-400')}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && <div className="flex-1 h-px bg-[#E2E8F0] mx-3" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Color Picker Field ────────────────────────────────────────────────────
export function ColorField({ value, onChange, label }) {
  return (
    <Field label={label || 'Color'}>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-11 h-9 border-none cursor-pointer rounded-lg p-0.5"
          style={{ background: 'none', padding: 0 }}
        />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1"
          placeholder="#3B82F6"
        />
      </div>
    </Field>
  );
}
