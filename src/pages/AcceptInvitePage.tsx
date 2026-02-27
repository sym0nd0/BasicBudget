import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Button } from '../components/ui/Button';

export function AcceptInvitePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshAuth } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteInfo, setInviteInfo] = useState<{
    householdName: string;
    inviteeEmail: string;
    userExists: boolean;
  } | null>(null);
  const [accepting, setAccepting] = useState(false);

  const token = searchParams.get('token');

  // On mount: fetch invite info
  useEffect(() => {
    (async () => {
      if (!token) {
        setError('No invite token provided');
        setLoading(false);
        return;
      }

      try {
        const info = await api.getInviteInfo(token);
        setInviteInfo(info);

        // If user is logged in, auto-accept immediately
        if (user) {
          handleAccept(token);
        }
      } catch (err) {
        setError((err as Error).message || 'Invalid or expired invite link');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, user]);

  const handleAccept = async (tkn: string) => {
    setAccepting(true);
    try {
      await api.acceptInvite(tkn);
      localStorage.removeItem('pending_invite_token');
      await refreshAuth();
      // Show success and redirect after a brief delay
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setError((err as Error).message);
      setAccepting(false);
    }
  };

  // User not logged in and invite is for existing user
  if (!loading && inviteInfo && !user && inviteInfo.userExists) {
    localStorage.setItem('pending_invite_token', token!);
    const message = `You're invited to join ${inviteInfo.householdName}. Please sign in to accept the invitation.`;
    navigate(`/login?message=${encodeURIComponent(message)}`);
    return null;
  }

  // User not logged in and invite is for new user
  if (!loading && inviteInfo && !user && !inviteInfo.userExists) {
    navigate(`/register?email=${encodeURIComponent(inviteInfo.inviteeEmail)}&token=${encodeURIComponent(token!)}`);
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/favicon.png" alt="BasicBudget" className="w-12 h-12 rounded-xl mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Accept Invite</h1>
        </div>

        <div className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-sm border border-[var(--color-border)]">
          {loading ? (
            <div className="text-center text-[var(--color-text-muted)]">Loading invite details...</div>
          ) : error ? (
            <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-light)] rounded-lg px-3 py-2">
              {error}
            </div>
          ) : inviteInfo && user ? (
            <div className="flex flex-col gap-4">
              {accepting ? (
                <>
                  <div className="text-center text-[var(--color-success)] bg-[var(--color-success-light)] rounded-lg px-3 py-2">
                    Joining {inviteInfo.householdName}...
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)] text-center">Redirecting...</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-[var(--color-text)]">
                    You're being invited to join <strong>{inviteInfo.householdName}</strong>
                  </p>
                  <Button onClick={() => handleAccept(token!)} disabled={accepting} className="w-full justify-center">
                    {accepting ? 'Joining…' : 'Accept Invite'}
                  </Button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
