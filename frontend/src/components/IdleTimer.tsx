import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlarmClock } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import toast from 'react-hot-toast';
import { idleTimeoutSeconds, idleWarningSeconds } from '../lib/appConfig';
import { ModalShell } from './ModalShell';

const PRE_WARNING_SECONDS = 60;

export function IdleTimer() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(idleTimeoutSeconds - idleWarningSeconds);
  const idleTimeRef = useRef(0);
  const showWarningRef = useRef(false);
  const preWarningShownRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  const resetTimer = useCallback(() => {
    idleTimeRef.current = 0;
    showWarningRef.current = false;
    preWarningShownRef.current = false;
    setShowWarning(false);
    setCountdown(idleTimeoutSeconds - idleWarningSeconds);
  }, []);

  const handleStayLoggedIn = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

    const handleActivity = () => {
      if (!showWarningRef.current) {
        resetTimer();
      }
    };

    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    intervalRef.current = setInterval(() => {
      idleTimeRef.current += 1;

      const preWarningAt = idleWarningSeconds - PRE_WARNING_SECONDS;
      if (
        preWarningAt > 0 &&
        idleTimeRef.current >= preWarningAt &&
        idleTimeRef.current < idleWarningSeconds &&
        !preWarningShownRef.current
      ) {
        preWarningShownRef.current = true;
        const minutesLeft = Math.max(1, Math.round((idleTimeoutSeconds - idleTimeRef.current) / 60));
        toast(`Du logges ut om ca. ${minutesLeft} min pga. inaktivitet`, { duration: 5000 });
      }

      if (idleTimeRef.current >= idleTimeoutSeconds) {
        handleLogout();
      } else if (idleTimeRef.current >= idleWarningSeconds) {
        showWarningRef.current = true;
        setShowWarning(true);
        setCountdown(idleTimeoutSeconds - idleTimeRef.current);
      }
    }, 1000);

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [resetTimer, handleLogout]);

  return (
    // alertdialog without dismissal — the user must choose an action,
    // same as before the ModalShell migration.
    <ModalShell
      open={showWarning}
      onClose={handleStayLoggedIn}
      labelledBy="idle-warning-title"
      role="alertdialog"
      zIndex="z-[100]"
      dismissable={false}
    >
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
          <AlarmClock className="h-8 w-8 text-yellow-400" aria-hidden />
        </div>
        <h2 id="idle-warning-title" className="text-xl font-semibold text-dark-50 mb-2">Inaktivitetsvarsel</h2>
        <p className="text-dark-300 mb-4">
          Du har vært inaktiv en stund. Du blir automatisk logget ut om{' '}
          <span className="font-bold text-yellow-400">{countdown}</span> sekunder.
        </p>
        <p className="text-dark-400 text-sm mb-6">
          Klikk på knappen under for å fortsette økten din.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={handleLogout} className="flex-1 btn-secondary">
            Logg ut nå
          </button>
          <button type="button" onClick={handleStayLoggedIn} className="flex-1 btn-primary" data-autofocus>
            Fortsett økten
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
