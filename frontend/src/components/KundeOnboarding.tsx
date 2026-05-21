import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

const STORAGE_KEY = 'kunde-onboarding-v1';

const STEPS = [
  {
    title: 'Velkommen til kundeportalen',
    body: 'Her ser du en oversikt over dine ordrer og nøkkeltall.',
    cta: 'Se dashboard',
    path: '/kunde',
  },
  {
    title: 'Din bedriftsprofil',
    body: 'Under Min konto finner du firmainfo, kundegruppe og handelsoversikt — som et digitalt kundepass.',
    cta: 'Min konto',
    path: '/kunde/konto',
  },
  {
    title: 'Finn og filtrer ordrer',
    body: 'Under Ordrer kan du søke, filtrere på dato og lagre dine favorittvisninger.',
    cta: 'Gå til ordrer',
    path: '/kunde/orders',
  },
  {
    title: 'Utforsk statistikk',
    body: 'Bruk Statistikk og Avansert Analyse for å forstå kjøpsmønstre over tid.',
    cta: 'Åpne statistikk',
    path: '/kunde/statistics',
  },
  {
    title: 'Se dine priser',
    body: 'Under Mine priser finner du avtalte prisregler og rabatter som gjelder for kontoen din.',
    cta: 'Mine priser',
    path: '/kunde/pricing',
  },
];

export function useKundeOnboarding() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'done';
    } catch {
      return false;
    }
  });

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'done');
    setOpen(false);
  };

  return { open, dismiss };
}

export function KundeOnboardingModal({ open, onDismiss }: { open: boolean; onDismiss: () => void }) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  if (!open) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-md rounded-xl border border-dark-700 bg-dark-900 p-6 shadow-2xl"
        role="dialog"
        aria-labelledby="onboarding-title"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-4 top-4 text-dark-400 hover:text-white"
          aria-label="Lukk"
        >
          <X className="h-5 w-5" />
        </button>
        <p className="text-xs text-primary-400 font-medium mb-2">
          Steg {step + 1} av {STEPS.length}
        </p>
        <h2 id="onboarding-title" className="text-xl font-semibold text-dark-50 pr-8">
          {current.title}
        </h2>
        <p className="mt-3 text-sm text-dark-300">{current.body}</p>
        <div className="mt-6 flex gap-3">
          {!isLast ? (
            <>
              <button type="button" onClick={onDismiss} className="btn-secondary flex-1">
                Hopp over
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={() => {
                  navigate(current.path);
                  setStep((s) => s + 1);
                }}
              >
                {current.cta}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => {
                navigate(current.path);
                onDismiss();
              }}
            >
              Kom i gang
            </button>
          )}
        </div>
        {step > 0 && !isLast && (
          <button
            type="button"
            className="mt-3 w-full text-sm text-dark-400 hover:text-dark-200"
            onClick={() => setStep((s) => s - 1)}
          >
            Tilbake
          </button>
        )}
      </div>
    </div>
  );
}
