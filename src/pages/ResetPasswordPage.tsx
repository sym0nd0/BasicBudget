import { useState, type FormEvent } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setError('');
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      navigate('/login?reset=1');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
        <div className="text-center">
          <p className="text-[var(--color-text-muted)]">Invalid reset link.</p>
          <Link to="/forgot-password" className="text-[var(--color-primary)] hover:underline mt-2 block">Request a new one</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)] flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
            £
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Set a new password</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-sm border border-[var(--color-border)] flex flex-col gap-4">
          {error && (
            <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-light)] rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <Input
            label="New password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Min 8 chars, upper, lower, digit"
            required
            autoComplete="new-password"
          />
          <Input
            label="Confirm new password"
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="new-password"
          />
          <Button type="submit" disabled={loading} className="w-full justify-center">
            {loading ? 'Resetting…' : 'Reset password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
