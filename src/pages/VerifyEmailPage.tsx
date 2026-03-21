import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('error');
      setMessage('No verification token provided.');
      return;
    }
    api.verifyEmail(token)
      .then(r => { setStatus('success'); setMessage(r.message); })
      .catch(err => { setStatus('error'); setMessage((err as Error).message); });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-sm text-center">
        <img src="/favicon.png" alt="BasicBudget" className="w-12 h-12 rounded-xl mx-auto mb-6" />
        {status === 'verifying' && (
          <p className="text-[var(--color-text-muted)]">Verifying your email…</p>
        )}
        {status === 'success' && (
          <>
            <h1 className="text-xl font-bold text-[var(--color-text)] mb-2">Email verified!</h1>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">{message}</p>
            <Link to="/login" className="text-[var(--color-primary)] hover:underline">
              Sign in now
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="text-xl font-bold text-[var(--color-text)] mb-2">Verification failed</h1>
            <p className="text-sm text-[var(--color-danger)] mb-4">{message}</p>
            <Link to="/login" className="text-[var(--color-primary)] hover:underline">
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
