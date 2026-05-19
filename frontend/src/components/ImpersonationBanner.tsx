import { Link } from 'react-router-dom';

interface ImpersonationBannerProps {
  kundenr?: string;
}

/** Shown when an admin browses customer routes. */
export function ImpersonationBanner({ kundenr }: ImpersonationBannerProps) {
  return (
    <div
      className="mb-4 rounded-lg border border-amber-700/50 bg-amber-900/30 px-4 py-3 text-sm text-amber-100"
      role="status"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          <strong>Kundevisning</strong>
          {kundenr ? ` — du ser portalen som kunde ${kundenr}.` : ' — du ser kundeportalen som administrator.'}
        </p>
        <Link to="/admin" className="btn-secondary text-xs shrink-0">
          Tilbake til admin
        </Link>
      </div>
    </div>
  );
}
