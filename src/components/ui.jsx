import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Loader2, X, CheckCircle2, AlertTriangle } from 'lucide-react';

export function Logo({ className = '', light = false }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill={light ? '#F3F5EF' : '#1C5C32'} />
        <rect x="12" y="38" width="40" height="6" rx="3" fill="#D9A93A" />
        <rect x="12" y="38" width="22" height="6" rx="3" fill={light ? '#1C5C32' : '#F3F5EF'} />
        <path d="M18 32V18M26 32V14M34 32V20M42 32V16" stroke={light ? '#1C5C32' : '#F3F5EF'} strokeWidth="4" strokeLinecap="round" />
      </svg>
      <span className={`font-display text-[19px] font-bold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>StrawSlot</span>
    </span>
  );
}

const BTN = {
  primary: 'bg-sprout-600 text-white hover:bg-sprout-700 active:bg-sprout-900 shadow-sm',
  dark: 'bg-ink text-white hover:bg-ink-soft',
  gold: 'bg-stubble-500 text-ink hover:bg-stubble-300',
  ghost: 'bg-transparent text-ink hover:bg-smoke-100',
  outline: 'bg-white text-ink border border-line hover:border-ink-mute',
  danger: 'bg-fire-500 text-white hover:bg-fire-600',
};
export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, children, className = '', ...p }) {
  const sz = size === 'lg' ? 'h-12 px-5 text-[15px]' : size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm';
  return (
    <button {...p} disabled={p.disabled || loading} className={`inline-flex items-center justify-center gap-2 rounded-ctl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${sz} ${BTN[variant]} ${className}`}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export function Panel({ title, action, children, className = '', pad = true, sub }) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div>
            {title && <h2 className="text-[17px] font-bold">{title}</h2>}
            {sub && <p className="text-xs text-ink-mute mt-0.5">{sub}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={pad ? 'px-5 pb-5' : ''}>{children}</div>
    </section>
  );
}

export function Badge({ className = '', children, dot }) {
  return (
    <span className={`chip ${className}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
      {children}
    </span>
  );
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-ink-mute" role="status">
      <Loader2 className="h-5 w-5 animate-spin" /> <span className="text-sm">{label}…</span>
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-3 rounded-ctl border border-fire-100 bg-fire-50 px-4 py-3 text-sm text-fire-600" role="alert">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{error.message || String(error)}</div>
      {onRetry && <button onClick={onRetry} className="font-semibold underline">Retry</button>}
    </div>
  );
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {Icon && <Icon className="h-8 w-8 text-smoke-400" />}
      <p className="font-semibold">{title}</p>
      {children && <div className="max-w-sm text-sm text-ink-mute">{children}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`w-full ${width} rounded-t-2xl bg-white shadow-pop sm:rounded-panel animate-drawer`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-ctl p-1.5 hover:bg-smoke-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, kind = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x, { id, text, kind }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[1100] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={`pointer-events-auto flex items-center gap-2 rounded-ctl px-4 py-3 text-sm font-medium shadow-pop animate-drawer ${i.kind === 'err' ? 'bg-fire-600 text-white' : 'bg-ink text-white'}`}>
            {i.kind === 'err' ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 text-sprout-300" />}
            {i.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function Segmented({ value, onChange, options, className = '' }) {
  return (
    <div className={`inline-flex rounded-ctl border border-line bg-white p-0.5 ${className}`} role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`rounded-[6px] px-3 py-1.5 text-sm font-semibold transition ${value === o.value ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LiveDot({ live, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-mute">
      <span className="relative flex h-2 w-2">
        {live && <span className="absolute inline-flex h-full w-full rounded-full bg-sprout-500 animate-ring" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${live ? 'bg-sprout-500' : 'bg-stubble-500'}`} />
      </span>
      {label}
    </span>
  );
}
