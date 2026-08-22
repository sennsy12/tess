import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Building2, User } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { PasswordInput } from '../components/PasswordInput';
import { supportMailto } from '../lib/appConfig';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

type LoginMode = 'standard' | 'kunde';

export function Login() {
  const [mode, setMode] = useState<LoginMode>('standard');
  const [username, setUsername] = useState('');
  const [kundenr, setKundenr] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useDocumentTitle('Innlogging');

  const { login, loginKunde, user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    if (user.role === 'admin') navigate('/admin', { replace: true });
    else if (user.role === 'analyse') navigate('/analyse', { replace: true });
    else navigate('/kunde', { replace: true });
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'kunde') {
        await loginKunde(kundenr, password);
        navigate('/kunde');
      } else {
        const user = await login(username, password);
        // Redirect based on role
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
    <div className="min-h-screen flex bg-dark-950">
      {/* Brand panel — statement piece on desktop */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden flex-col justify-between p-12 border-r border-gold-500/15">
        {/* Animated gradient mesh */}
        <div className="absolute inset-0" aria-hidden>
          <div className="absolute -top-1/4 -left-1/4 w-2/3 h-2/3 rounded-full bg-primary-600/20 blur-[140px] animate-pulse-slow" />
          <div
            className="absolute -bottom-1/4 -right-1/4 w-2/3 h-2/3 rounded-full bg-gold-500/10 blur-[140px] animate-pulse-slow"
            style={{ animationDelay: '1.8s' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-md bg-dark-950 border border-gold-500/40 flex items-center justify-center">
            <span className="font-display text-xl font-light text-gold-400">T</span>
          </div>
          <span className="text-sm font-semibold text-white tracking-[0.22em] uppercase">Tess</span>
        </div>

        <div className="relative z-10 max-w-md animate-in-up">
          <h1 className="text-4xl xl:text-5xl font-light font-display text-white leading-tight tracking-tight">
            Innsikt som gir{' '}
            <span className="text-gold-300">konkurransefortrinn</span>.
          </h1>
          <p className="mt-5 text-dark-400 text-lg font-light leading-relaxed">
            Ordre, priser og analyse — samlet i én plattform for hele verdikjeden.
          </p>
        </div>

        <p className="relative z-10 text-xs text-dark-600 uppercase tracking-wider">
          &copy; {new Date().getFullYear()} TESS AS
        </p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className={`w-full max-w-md transition-all duration-500 transform ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          {/* Compact logo (mobile / form side) */}
          <div className="lg:hidden text-center mb-10">
            <div className="w-14 h-14 mx-auto flex items-center justify-center mb-4 rounded-md bg-dark-950 border border-gold-500/40">
              <span className="font-display text-2xl font-light text-gold-400">T</span>
            </div>
            <h1 className="text-2xl font-semibold text-white tracking-[0.18em] uppercase">Tess</h1>
            <p className="text-dark-400 mt-1 text-sm tracking-wide">Sales Order Management</p>
          </div>

          {/* Login Card */}
          <div className="card p-6 sm:p-8">
          {/* Mode Tabs */}
          <div
            role="tablist"
            aria-label="Innloggingstype"
            className="flex mb-8 bg-dark-950 rounded-md p-1 border border-dark-800"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'standard'}
              aria-controls="login-panel"
              onClick={() => setMode('standard')}
              className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors duration-150 ${
                mode === 'standard'
                  ? 'bg-dark-700 text-white'
                  : 'text-dark-400 hover:text-dark-200'
              }`}
            >
              Ansatt
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'kunde'}
              aria-controls="login-panel"
              onClick={() => setMode('kunde')}
              className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors duration-150 ${
                mode === 'kunde'
                  ? 'bg-dark-700 text-white'
                  : 'text-dark-400 hover:text-dark-200'
              }`}
            >
              Kunde
            </button>
          </div>

            <form
              id="login-panel"
              role="tabpanel"
              onSubmit={handleSubmit}
              className="space-y-5"
              aria-busy={isLoading}
            >
              <div className="space-y-4">
                {mode === 'standard' ? (
                  <div className="space-y-1.5 animate-in-up">
                    <label className="label text-xs uppercase tracking-wider font-semibold text-dark-400">Brukernavn</label>
                    <div className="relative group">
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="input pl-10 transition-all group-hover:border-dark-600"
                        placeholder="Skriv inn brukernavn"
                        required
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500 group-focus-within:text-primary-400 transition-colors">
                        <User className="h-4 w-4" aria-hidden />
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 animate-in-up">
                    <label className="label text-xs uppercase tracking-wider font-semibold text-dark-400">Kundenummer</label>
                    <div className="relative group">
                      <input
                        type="text"
                        value={kundenr}
                        onChange={(e) => setKundenr(e.target.value)}
                        className="input pl-10 transition-all group-hover:border-dark-600"
                        placeholder="F.eks. K001"
                        required
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500 group-focus-within:text-primary-400 transition-colors">
                        <Building2 className="h-4 w-4" aria-hidden />
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 animate-in-up" style={{ animationDelay: '100ms' }}>
                  <label htmlFor="login-password" className="label text-xs uppercase tracking-wider font-semibold text-dark-400">
                    Passord
                  </label>
                  <PasswordInput
                    id="login-password"
                    value={password}
                    onChange={setPassword}
                    placeholder="Skriv inn passord"
                    autoComplete="current-password"
                    required
                    disabled={isLoading}
                    className="input w-full"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-md text-red-400 text-sm flex items-start gap-2.5" role="alert">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden />
                  <p>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary py-3 text-sm font-semibold tracking-wide mt-2"
              >
                <span className={`flex items-center justify-center gap-2 ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}>
                  Logg inn
                </span>
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  </div>
                )}
              </button>

              <p className="text-center text-sm text-dark-400">
                <a href={supportMailto} className="text-primary-400 hover:underline">
                  Glemt passord?
                </a>
                <span className="mx-1">·</span>
                Kontakt support for hjelp med innlogging.
              </p>
            </form>

            {import.meta.env.DEV && (
            <div className="mt-8 pt-6 border-t border-dark-800">
              <p className="text-[10px] text-dark-500 text-center mb-4 font-semibold uppercase tracking-widest">Demo Tilgang (kun dev)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-dark-800/50 p-3 rounded-md border border-dark-700 hover:bg-dark-800 transition-colors cursor-help group">
                  <div className="text-xs font-semibold text-dark-200 mb-1 flex items-center gap-1">Admin <span className="w-1.5 h-1.5 rounded-full bg-primary-500"></span></div>
                  <div className="text-[10px] text-dark-400 font-mono group-hover:text-primary-400 transition-colors">admin / admin123</div>
                </div>
                <div className="bg-dark-800/50 p-3 rounded-md border border-dark-700 hover:bg-dark-800 transition-colors cursor-help group">
                  <div className="text-xs font-semibold text-dark-200 mb-1 flex items-center gap-1">Analyse <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span></div>
                  <div className="text-[10px] text-dark-400 font-mono group-hover:text-blue-400 transition-colors">analyse / admin123</div>
                </div>
              </div>
              <div className="mt-3 bg-dark-800/30 p-3 rounded-md border border-dark-700 text-center">
                 <p className="text-[10px] text-dark-400">Kunde: <strong className="text-dark-300">K000001</strong> / <strong className="text-dark-300">admin123</strong></p>
              </div>
            </div>
            )}
          </div>

          <p className="text-center text-dark-600 text-xs mt-8">
            &copy; {new Date().getFullYear()} TESS AS. Alle rettigheter reservert.
          </p>
        </div>
      </div>
    </div>
  );
}
