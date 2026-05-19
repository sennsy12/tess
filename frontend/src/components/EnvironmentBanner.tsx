import { appEnvironment, environmentLabel, isProduction } from '../lib/appConfig';

export function EnvironmentBanner() {
  if (isProduction && appEnvironment !== 'staging') {
    return null;
  }

  const styles =
    appEnvironment === 'staging'
      ? 'bg-amber-600/90 text-amber-950'
      : 'bg-blue-600/90 text-white';

  return (
    <div
      className={`sticky top-0 z-[60] px-4 py-1.5 text-center text-xs font-semibold tracking-wide ${styles}`}
      role="status"
    >
      {environmentLabel[appEnvironment]} — ikke produksjonsdata
    </div>
  );
}
