import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Layout } from '../components/Layout';
import { PasswordInput } from '../components/PasswordInput';
import { useAuth } from '../context/useAuth';
import { authApi } from '../lib/api';

export function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const homePath =
    user?.role === 'admin' ? '/admin' : user?.role === 'analyse' ? '/analyse' : '/kunde';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Nytt passord og bekreftelse stemmer ikke overens.');
      return;
    }
    if (newPassword.length < 4) {
      toast.error('Nytt passord må være minst 4 tegn.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success('Passordet er oppdatert.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Kunne ikke endre passord.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout title="Innstillinger">
      <div className="mx-auto max-w-lg space-y-6">
        <button type="button" onClick={() => navigate(homePath)} className="btn-secondary">
          ← Tilbake
        </button>

        <div className="card space-y-4">
          <h3 className="text-lg font-semibold">Profil</h3>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-dark-400">Brukernavn</dt>
              <dd className="font-medium">{user?.username}</dd>
            </div>
            <div>
              <dt className="text-dark-400">Rolle</dt>
              <dd className="font-medium capitalize">{user?.role}</dd>
            </div>
            {user?.kundenr && (
              <div>
                <dt className="text-dark-400">Kundenummer</dt>
                <dd className="font-medium">{user.kundenr}</dd>
              </div>
            )}
          </dl>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <h3 className="text-lg font-semibold">Endre passord</h3>
          <p className="text-sm text-dark-400">
            {user?.role === 'kunde'
              ? 'Oppdater passordet du bruker ved innlogging med kundenummer.'
              : 'Oppdater ditt eget passord. Administratorer kan fortsatt tilbakestille andre brukere under Brukere.'}
          </p>
          <div>
            <label className="label" htmlFor="current-password">
              Nåværende passord
            </label>
            <PasswordInput
              id="current-password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={setCurrentPassword}
              required
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="label" htmlFor="new-password">
              Nytt passord
            </label>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              value={newPassword}
              onChange={setNewPassword}
              required
              minLength={4}
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="label" htmlFor="confirm-password">
              Bekreft nytt passord
            </label>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              required
              minLength={4}
              disabled={isSubmitting}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Lagrer…' : 'Lagre nytt passord'}
          </button>
        </form>
      </div>
    </Layout>
  );
}
