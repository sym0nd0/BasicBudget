import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function TotpPage() {
  const { refreshAuth } = useAuth();
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (useRecovery) {
        await api.totpVerifyRecovery(recoveryCode);
      } else {
        await api.totpVerify(token);
      }
      await refreshAuth();

      // Check for pending invite token after successful 2FA
      const pendingToken = localStorage.getItem('pending_invite_token');
      if (pendingToken) {
        localStorage.removeItem('pending_invite_token');
        navigate(`/accept-invite?token=${pendingToken}`);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/favicon.png" alt="BasicBudget" className="w-12 h-12 rounded-xl mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Two-factor authentication</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            {useRecovery ? 'Enter a recovery code.' : 'Enter the 6-digit code from your authenticator app.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-sm border border-[var(--color-border)] flex flex-col gap-4">
          {error && (
            <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-light)] rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {useRecovery ? (
            <Input
              label="Recovery code"
              value={recoveryCode}
              onChange={e => setRecoveryCode(e.target.value.toUpperCase())}
              placeholder="XXXXXXXX"
              required
              autoComplete="one-time-code"
            />
          ) : (
            <Input
              label="Authenticator code"
              value={token}
              onChange={e => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
            />
          )}
          <Button type="submit" disabled={loading} className="w-full justify-center">
            {loading ? 'Verifying…' : 'Verify'}
          </Button>
          <button
            type="button"
            className="text-xs text-[var(--color-text-muted)] hover:underline text-center"
            onClick={() => { setUseRecovery(!useRecovery); setToken(''); setRecoveryCode(''); setError(''); }}
          >
            {useRecovery ? 'Use authenticator code instead' : 'Use a recovery code instead'}
          </button>
        </form>
      </div>
    </div>
  );
}
