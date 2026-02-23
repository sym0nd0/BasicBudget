import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setSubmitted(true);
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
          <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)] flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
            £
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Reset your password</h1>
        </div>

        <div className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-sm border border-[var(--color-border)]">
          {submitted ? (
            <p className="text-sm text-[var(--color-text)]">
              If an account exists with that email address, we've sent a password reset link. Check your inbox (and spam folder).
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && (
                <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-light)] rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
              <Button type="submit" disabled={loading} className="w-full justify-center">
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          )}
        </div>

        <p className="text-center mt-4 text-sm text-[var(--color-text-muted)]">
          <Link to="/login" className="text-[var(--color-primary)] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
