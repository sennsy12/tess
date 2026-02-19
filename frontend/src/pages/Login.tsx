import { useState, useEffect } from 'react';
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
  const [mounted, setMounted] = useState(false);

  const { login, loginKunde } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setMounted(true);
  }, []);

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
        // Redirect based on role
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-dark-950">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary-600/10 blur-[120px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-600/10 blur-[120px] animate-pulse-slow" style={{ animationDelay: '1.5s' }}></div>
      </div>

      <div className={`w-full max-w-md relative z-10 p-4 transition-all duration-700 transform ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-600 to-primary-500 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-2xl shadow-primary-500/30 transform grid place-items-center">
            <span className="text-3xl font-bold text-white tracking-tighter">T</span>
          </div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-dark-400 mb-2 tracking-tight">TESS</h1>
          <p className="text-dark-400 font-medium tracking-wide">Sales Order Management</p>
        </div>

        {/* Login Card */}
        <div className="glass-panel rounded-2xl p-1 overflow-hidden">
          <div className="bg-dark-900/40 p-6 sm:p-8 rounded-xl backdrop-blur-sm">
            {/* Mode Tabs */}
            <div className="flex mb-8 bg-dark-800/60 rounded-xl p-1.5 backdrop-blur-sm border border-dark-700/50">
              <button
                type="button"
                onClick={() => setMode('standard')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-300 ${
                  mode === 'standard'
                    ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/25'
                    : 'text-dark-400 hover:text-dark-200 hover:bg-dark-700/30'
                }`}
              >
                Ansatt
              </button>
              <button
                type="button"
                onClick={() => setMode('kunde')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-300 ${
                  mode === 'kunde'
                    ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/25'
                    : 'text-dark-400 hover:text-dark-200 hover:bg-dark-700/30'
                }`}
              >
                Kunde
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
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
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500 group-focus-within:text-primary-400 transition-colors">👤</span>
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
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500 group-focus-within:text-primary-400 transition-colors">🏢</span>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 animate-in-up" style={{ animationDelay: '100ms' }}>
                  <label className="label text-xs uppercase tracking-wider font-semibold text-dark-400">Passord</label>
                  <div className="relative group">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input pl-10 transition-all group-hover:border-dark-600"
                      placeholder="Skriv inn passord"
                      required
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500 group-focus-within:text-primary-400 transition-colors">🔒</span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start gap-3 animate-in-up">
                  <span className="text-lg">⚠️</span>
                  <p>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary py-3.5 text-base font-bold tracking-wide shadow-xl shadow-primary-900/20 relative overflow-hidden group mt-2"
              >
                <span className={`relative z-10 flex items-center justify-center gap-2 ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}>
                  Logg inn
                  <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
                </span>
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  </div>
                )}
              </button>
            </form>

            {/* Demo credentials */}
            <div className="mt-8 pt-6 border-t border-dark-700/50">
              <p className="text-[10px] text-dark-500 text-center mb-4 font-bold uppercase tracking-widest">Demo Tilgang</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-dark-800/50 p-3 rounded-lg border border-dark-700/50 hover:bg-dark-800 transition-colors cursor-help group" title="Passord: admin123">
                  <div className="text-xs font-semibold text-dark-200 mb-1 flex items-center gap-1">Admin <span className="w-1.5 h-1.5 rounded-full bg-primary-500"></span></div>
                  <div className="text-[10px] text-dark-400 font-mono group-hover:text-primary-400 transition-colors">admin</div>
                </div>
                <div className="bg-dark-800/50 p-3 rounded-lg border border-dark-700/50 hover:bg-dark-800 transition-colors cursor-help group" title="Passord: admin123">
                  <div className="text-xs font-semibold text-dark-200 mb-1 flex items-center gap-1">Analyse <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span></div>
                  <div className="text-[10px] text-dark-400 font-mono group-hover:text-blue-400 transition-colors">analyse</div>
                </div>
              </div>
              <div className="mt-3 bg-dark-800/30 p-3 rounded-lg border border-dark-700/30 text-center">
                 <p className="text-[10px] text-dark-400">Kunde: <strong className="text-dark-300">K000001</strong> / <strong className="text-dark-300">admin123</strong></p>
              </div>
            </div>
          </div>
        </div>
        
        <p className="text-center text-dark-600 text-xs mt-8 font-medium">
          &copy; {new Date().getFullYear()} TESS AS. Alle rettigheter reservert.
        </p>
      </div>
    </div>
  );
}
