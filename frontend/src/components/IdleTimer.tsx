import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const IDLE_TIMEOUT = 120; // 2 minutes in seconds
const WARNING_THRESHOLD = 90; // Show warning after 90 seconds of inactivity

export function IdleTimer() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(IDLE_TIMEOUT - WARNING_THRESHOLD);
  const idleTimeRef = useRef(0);
  const showWarningRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  const resetTimer = useCallback(() => {
    idleTimeRef.current = 0;
    showWarningRef.current = false;
    setShowWarning(false);
    setCountdown(IDLE_TIMEOUT - WARNING_THRESHOLD);
  }, []);

  const handleStayLoggedIn = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

    const handleActivity = () => {
      // Only reset if warning is not showing
      if (!showWarningRef.current) {
        resetTimer();
      }
    };

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Start the idle timer
    intervalRef.current = setInterval(() => {
      idleTimeRef.current += 1;

      if (idleTimeRef.current >= IDLE_TIMEOUT) {
        // Time's up - logout
        handleLogout();
      } else if (idleTimeRef.current >= WARNING_THRESHOLD) {
        // Show warning and update countdown
        showWarningRef.current = true;
        setShowWarning(true);
        setCountdown(IDLE_TIMEOUT - idleTimeRef.current);
      }
    }, 1000);

    return () => {
      // Cleanup
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [resetTimer, handleLogout]);

  if (!showWarning) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-dark-900 border border-dark-700 rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <span className="text-3xl">⏰</span>
          </div>
          <h2 className="text-xl font-semibold text-dark-50 mb-2">
            Inaktivitetsvarsel
          </h2>
          <p className="text-dark-300 mb-4">
            Du har vært inaktiv en stund. Du blir automatisk logget ut om{' '}
            <span className="font-bold text-yellow-400">{countdown}</span> sekunder.
          </p>
          <p className="text-dark-400 text-sm mb-6">
            Klikk på knappen under for å fortsette økten din.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleLogout}
              className="flex-1 btn-secondary"
            >
              Logg ut nå
            </button>
            <button
              onClick={handleStayLoggedIn}
              className="flex-1 btn-primary"
            >
              Fortsett økten
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
