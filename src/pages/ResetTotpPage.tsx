import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function ResetTotpPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.totpConfirmReset(token, password);
      navigate('/login?reset2fa=1');
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
          <Link to="/login" className="text-[var(--color-primary)] hover:underline mt-2 block">Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/favicon.png" alt="BasicBudget" className="w-12 h-12 rounded-xl mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Reset two-factor authentication</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-sm border border-[var(--color-border)] flex flex-col gap-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            Confirm your account password to disable 2FA and generate a fresh setup on your next login.
          </p>
          {error && (
            <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-light)] rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
          <Button type="submit" disabled={loading} className="w-full justify-center">
            {loading ? 'Resetting…' : 'Reset 2FA'}
          </Button>
        </form>
      </div>
    </div>
  );
}
