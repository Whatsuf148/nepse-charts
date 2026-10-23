import { useState, type FormEvent } from 'react';
import type { Sync } from '../sync/useSync';

function statusText(s: Sync['status']) {
  switch (s.state) {
    case 'syncing':
      return 'Syncing…';
    case 'synced':
      return 'Synced';
    case 'error':
      return `Sync failed${s.error ? `: ${s.error}` : ''}`;
    default:
      return '';
  }
}

export default function AccountMenu({ sync }: { sync: Sync }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);

  if (!sync.configured || !sync.ready) return null;

  if (sync.email) {
    return (
      <div className="account">
        <span className={`dot ${sync.status.state}`} title={statusText(sync.status)} />
        <span className="muted who" title={sync.email}>
          {sync.email}
        </span>
        {sync.status.state === 'error' && <button onClick={sync.syncNow}>Retry</button>}
        <button onClick={() => void sync.signOut()}>Sign out</button>
      </div>
    );
  }

  const run = async (fn: () => Promise<{ error?: string; notice?: string }>) => {
    setBusy(true);
    setMsg(null);
    const r = await fn();
    setBusy(false);
    if (r.error) setMsg({ kind: 'error', text: r.error });
    else if (r.notice) setMsg({ kind: 'ok', text: r.notice });
    else setOpen(false); // signed in; the menu switches to the account view
    if (!r.error) setPassword('');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(() => sync.signIn(email.trim(), password));
  };

  return (
    <div className="account">
      <button onClick={() => setOpen(true)}>Sign in</button>
      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <form className="dialog" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <h2>Sign in to sync</h2>
            <p className="muted">Your watchlist, portfolio, alerts and drawings follow you across devices.</p>
            <label>
              Email
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              Password
              <input
                type="password"
                minLength={8}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {msg && <div className={msg.kind === 'error' ? 'error' : 'notice'}>{msg.text}</div>}
            <div className="row">
              <button type="submit" className="active" disabled={busy || password.length < 8}>
                Sign in
              </button>
              <button type="button" disabled={busy || password.length < 8} onClick={() => void run(() => sync.signUp(email.trim(), password))}>
                Create account
              </button>
              <button type="button" disabled={busy || !email} onClick={() => void run(() => sync.magicLink(email.trim()))}>
                Email me a link
              </button>
              <button type="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
