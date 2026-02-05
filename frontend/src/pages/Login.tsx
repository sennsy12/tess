import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type LoginMode = 'standard' | 'kunde';

export function Login() {
  const [mode, setMode] = useState<LoginMode>('standard');
  const [username, setUsername] = useState('');
  const [kundenr, setKundenr] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login, loginKunde } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'kunde') {
        await loginKunde(kundenr, password);
        navigate('/kunde');
      } else {
        await login(username, password);
        // Redirect based on role - we'll get user from context after login
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.role === 'admin') {
          navigate('/admin');
        } else if (user.role === 'analyse') {
          navigate('/analyse');
        } else {
          navigate('/kunde');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Innlogging feilet. Sjekk brukernavn og passord.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-400 mb-2">TESS</h1>
          <p className="text-dark-400">Sales Order Management System</p>
        </div>

        {/* Login Card */}
        <div className="card">
          {/* Mode Tabs */}
          <div className="flex mb-6 bg-dark-800 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setMode('standard')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                mode === 'standard'
                  ? 'bg-primary-600 text-white'
                  : 'text-dark-400 hover:text-dark-200'
              }`}
            >
              Admin / Analyse
            </button>
            <button
              type="button"
              onClick={() => setMode('kunde')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                mode === 'kunde'
                  ? 'bg-primary-600 text-white'
                  : 'text-dark-400 hover:text-dark-200'
              }`}
            >
              Kunde
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'standard' ? (
              <div>
                <label className="label">Brukernavn</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input"
                  placeholder="Skriv inn brukernavn"
                  required
                />
              </div>
            ) : (
              <div>
                <label className="label">Kundenummer</label>
                <input
                  type="text"
                  value={kundenr}
                  onChange={(e) => setKundenr(e.target.value)}
                  className="input"
                  placeholder="F.eks. K001"
                  required
                />
              </div>
            )}

            <div>
              <label className="label">Passord</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Skriv inn passord"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-3 text-lg font-semibold"
            >
              {isLoading ? 'Logger inn...' : 'Logg inn'}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 pt-6 border-t border-dark-800">
            <p className="text-xs text-dark-500 text-center mb-2 font-medium">Test-innlogging:</p>
            <div className="space-y-2 text-xs text-dark-400">
              <div className="bg-dark-800/50 p-2 rounded flex justify-between">
                <span><strong>Admin:</strong> admin / admin123</span>
                <span className="text-primary-500/70">Full tilgang</span>
              </div>
              <div className="bg-dark-800/50 p-2 rounded flex justify-between">
                <span><strong>Analyse:</strong> analyse / admin123</span>
                <span className="text-blue-500/70">Kun dashboard</span>
              </div>
              <div className="bg-dark-800/50 p-2 rounded">
                <p className="mb-1"><strong>Kunde-innlogging:</strong></p>
                <p>Bruk kundenummer (f.eks. <strong>K000001</strong>) og passord <strong>kunde123</strong></p>
                <p className="text-dark-500 mt-1 italic">* Krever at bulk-data er generert i ETL-panelet</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
