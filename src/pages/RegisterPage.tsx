import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password, displayName || undefined);
      setSuccess('Registration successful! Please check your email to verify your account.');
      setTimeout(() => navigate('/login'), 3000);
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
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Create your account</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-sm border border-[var(--color-border)] flex flex-col gap-4">
          {error && (
            <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-light)] rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {success && (
            <div className="text-sm text-[var(--color-success)] bg-[var(--color-success-light)] rounded-lg px-3 py-2">
              {success}
            </div>
          )}
          <Input
            label="Display name (optional)"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Min 8 chars, upper, lower, digit"
            required
            autoComplete="new-password"
          />
          <Button type="submit" disabled={loading} className="w-full justify-center">
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="text-center mt-4 text-sm text-[var(--color-text-muted)]">
          Already have an account?{' '}
          <Link to="/login" className="text-[var(--color-primary)] hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
