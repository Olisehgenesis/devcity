'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type Session = { username: string | null; label: string | null; testAccount: boolean } | null;

export function DevTestAccountPanel({ onChanged }: { onChanged: () => void }) {
  const [enabled, setEnabled] = useState(false);
  const [session, setSession] = useState<Session>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function refresh() {
    const response = await fetch('/api/dev/test-accounts', { credentials: 'include' });
    if (!response.ok) {
      setEnabled(false);
      return;
    }
    const body = await response.json() as { enabled?: boolean; session?: Session };
    setEnabled(Boolean(body.enabled));
    setSession(body.session ?? null);
  }

  useEffect(() => {
    void refresh().catch(() => setEnabled(false));
  }, []);

  async function submit(action: 'sign-up' | 'sign-in' | 'sign-out') {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/dev/test-accounts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, username, password }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        setError(body.error || 'That test-account request failed.');
        return;
      }
      setPassword('');
      await refresh();
      onChanged();
    } catch {
      setError('You appear to be offline. Try again when the connection returns.');
    } finally {
      setPending(false);
    }
  }

  if (!enabled) return null;

  return (
    <section className="dev-test-account" aria-label="Local test account">
      <p className="profile-gate-kicker">Local test account</p>
      {session?.testAccount ? (
        <>
          <p>Signed in as <strong>{session.username}</strong>. This is a test account.</p>
          <Button type="button" disabled={pending} onClick={() => void submit('sign-out')}>{pending ? 'Signing out…' : 'Sign out of test account'}</Button>
        </>
      ) : (
        <>
          <p>Username and password for this machine. Passkeys stay the way into a real account.</p>
          <label htmlFor="dev-test-username">Username</label>
          <input id="dev-test-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
          <label htmlFor="dev-test-password">Password</label>
          <input id="dev-test-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <div className="dev-test-actions">
            <Button type="button" disabled={pending} onClick={() => void submit('sign-in')}>{pending ? 'Working…' : 'Sign in'}</Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => void submit('sign-up')}>Create test account</Button>
          </div>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
