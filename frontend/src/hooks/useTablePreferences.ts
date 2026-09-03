import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/useAuth';
import { tablePreferencesApi } from '../lib/api';
import {
  sanitizeColumnLabels,
  type TablePreferences,
} from '../types/tablePreferences';

export const PREF_SAVE_DEBOUNCE_MS = 800;
/** Prefs endres sjelden – lang staleTime, ingen bakgrunnspolling. */
const PREF_STALE_MS = 10 * 60_000;

export const tablePrefKeys = {
  all: () => ['table-prefs'] as const,
  one: (userKey: string, tableKey: string) => ['table-prefs', userKey, tableKey] as const,
};

interface UseTablePreferencesOptions {
  /** Kode-defaults – brukes når verken server eller legacy har noe. */
  defaultVisibleKeys: string[];
  /** Kjente kolonnenøkler – ukjente filtreres bort begge veier. */
  knownKeys?: string[];
  /**
   * Legacy localStorage-nøkkel (f.eks. `table:admin-orders`). Leses én gang
   * ved første last og migreres til server – deretter slettes den.
   * Density-nøkkel (`:density`) røres ikke – den er enhetsspesifikk.
   */
  legacyStorageKey?: string;
  enabled?: boolean;
}

interface LocalOverrides {
  visibleColumns: string[];
  /** Rå labels inkl. ""-slettinger (serveren normaliserer bort tomme). */
  columnLabels: Record<string, string>;
}

function sanitizeVisible(keys: unknown, defaults: string[], knownKeys?: string[]): string[] {
  const list = Array.isArray(keys) ? keys.filter((k): k is string => typeof k === 'string') : [];
  const filtered = list.filter((k) => (knownKeys ?? defaults).includes(k));
  return filtered.length > 0 ? filtered : [...defaults];
}

function readLegacyVisible(legacyKey: string | undefined, defaults: string[], knownKeys?: string[]): string[] | null {
  if (!legacyKey || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(legacyKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { visibleColumnKeys?: unknown };
    if (!parsed || !Array.isArray(parsed.visibleColumnKeys)) return null;
    const sanitized = sanitizeVisible(parsed.visibleColumnKeys, defaults, knownKeys);
    // Returner kun hvis legacy faktisk avviker fra defaults (ellers intet å migrere).
    const same =
      sanitized.length === defaults.length && sanitized.every((k, i) => k === defaults[i]);
    return same ? null : sanitized;
  } catch {
    return null;
  }
}

/**
 * Per-bruker tabellpreferanser med server som sannhet.
 *
 * Effektiv verdi = lokale overrides ?? server ?? defaults. Lagring PUT-es
 * debouncet (800ms) – ikke per klikk. Ved feil/offline faller lesing
 * stille tilbake til legacy/defaults; tabellen fungerer alltid.
 */
export function useTablePreferences(tableKey: string, options: UseTablePreferencesOptions) {
  const { defaultVisibleKeys, knownKeys, legacyStorageKey, enabled = true } = options;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // Bruker i nøkkelen: hindrer at bruker B arver bruker A sin cache
  // ved bytte i samme nettleser uten remount.
  const userKey = user ? `${user.role}:${user.id}` : 'anonymous';
  const [overrides, setOverrides] = useState<LocalOverrides | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const migratedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const overridesRef = useRef<LocalOverrides | null>(null);
  // Speil siste overrides til ref (for debounce-timeouten) – i effekt,
  // ikke under render.
  useEffect(() => {
    overridesRef.current = overrides;
  }, [overrides]);

  const defaults = useMemo(() => [...defaultVisibleKeys], [defaultVisibleKeys]);

  // Ny bruker = ny sannhet: dropp gamle overrides og migreringsflagg.
  useEffect(() => {
    migratedRef.current = false;
    setOverrides(null);
    setSaveError(false);
  }, [userKey]);

  const prefsQuery = useQuery<TablePreferences>({
    queryKey: tablePrefKeys.one(userKey, tableKey),
    queryFn: () => tablePreferencesApi.get(tableKey).then((res) => res.data),
    enabled: enabled && !!tableKey && !!user,
    staleTime: PREF_STALE_MS,
    placeholderData: (prev) => prev,
    retry: 1,
  });

  const serverVisible = useMemo(
    () => sanitizeVisible(prefsQuery.data?.visibleColumns, defaults, knownKeys),
    [prefsQuery.data?.visibleColumns, defaults, knownKeys],
  );
  const serverLabels = useMemo(
    () => sanitizeColumnLabels(prefsQuery.data?.columnLabels, knownKeys),
    [prefsQuery.data?.columnLabels, knownKeys],
  );

  // — Migrering av legacy localStorage (én gang, kun når serveren er tom) —
  useEffect(() => {
    if (migratedRef.current || !prefsQuery.isSuccess || !enabled) return;
    migratedRef.current = true;
    const hasServerPrefs =
      prefsQuery.data.visibleColumns !== null || Object.keys(serverLabels).length > 0;
    if (hasServerPrefs) return;
    const legacy = readLegacyVisible(legacyStorageKey, defaults, knownKeys);
    if (!legacy) return;
    tablePreferencesApi
      .save(tableKey, { visibleColumns: legacy })
      .then((res) => queryClient.setQueryData(tablePrefKeys.one(userKey, tableKey), res.data))
      .catch(() => {
        // Stille: legacy-nøkkelen beholdes og leses som fallback under.
      });
  }, [prefsQuery.isSuccess, prefsQuery.data, serverLabels, enabled, legacyStorageKey, defaults, knownKeys, tableKey, queryClient]);

  // — Fallback-lesing av legacy når server feiler eller er tom —
  const legacyFallback = useMemo(() => {
    if (prefsQuery.data && (prefsQuery.data.visibleColumns !== null || Object.keys(serverLabels).length > 0))
      return null;
    return readLegacyVisible(legacyStorageKey, defaults, knownKeys);
  }, [prefsQuery.data, serverLabels, legacyStorageKey, defaults, knownKeys]);

  const visibleKeys = overrides?.visibleColumns ?? legacyFallback ?? serverVisible;
  const columnLabels: Record<string, string> = useMemo(() => {
    const merged = { ...serverLabels, ...(overrides?.columnLabels ?? {}) };
    // ""-slettinger skal ikke lekke videre som labels.
    for (const [k, v] of Object.entries(merged)) {
      if (!v.trim()) delete merged[k];
    }
    return merged;
  }, [serverLabels, overrides?.columnLabels]);

  // Rå labels for lagring (beholder ""-slettinger slik at serveren sletter).
  const rawLabelsForSave = useMemo(
    () => ({ ...serverLabels, ...(overrides?.columnLabels ?? {}) }),
    [serverLabels, overrides?.columnLabels],
  );

  // — Debouncet lagring ved lokale endringer —
  useEffect(() => {
    if (!overrides || !enabled) return;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      const current = overridesRef.current;
      if (!current) return;
      setIsSaving(true);
      setSaveError(false);
      tablePreferencesApi
        .save(tableKey, { visibleColumns: current.visibleColumns, columnLabels: current.columnLabels })
        .then((res) => {
          queryClient.setQueryData(tablePrefKeys.one(userKey, tableKey), res.data);
          // Kun nullstill hvis brukeren ikke har gjort nyere endringer mens vi lagret.
          if (overridesRef.current === current) setOverrides(null);
        })
        .catch(() => setSaveError(true))
        .finally(() => setIsSaving(false));
    }, PREF_SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, [overrides, enabled, tableKey, queryClient]);

  // Slett legacy-nøkkel når serveren har bekreftet lagring (migrering fullført).
  useEffect(() => {
    if (!legacyStorageKey || typeof window === 'undefined') return;
    if (prefsQuery.data && prefsQuery.data.visibleColumns !== null) {
      try {
        localStorage.removeItem(legacyStorageKey);
      } catch {
        // Ignorer – ufarlig.
      }
    }
  }, [prefsQuery.data, legacyStorageKey]);

  const setVisibleKeys = useCallback(
    (keys: string[]) => {
      const sanitized = sanitizeVisible(keys, defaults, knownKeys);
      setOverrides((prev) => ({
        visibleColumns: sanitized,
        columnLabels: prev?.columnLabels ?? rawLabelsForSave,
      }));
    },
    [defaults, knownKeys, rawLabelsForSave],
  );

  const setLabel = useCallback(
    (columnKey: string, label: string) => {
      setOverrides((prev) => ({
        visibleColumns: prev?.visibleColumns ?? visibleKeys,
        columnLabels: { ...(prev?.columnLabels ?? rawLabelsForSave), [columnKey]: label },
      }));
    },
    [visibleKeys, rawLabelsForSave],
  );

  const resetLabels = useCallback(() => {
    const cleared: Record<string, string> = {};
    for (const key of Object.keys(rawLabelsForSave)) cleared[key] = '';
    setOverrides((prev) => ({
      visibleColumns: prev?.visibleColumns ?? visibleKeys,
      columnLabels: { ...(prev?.columnLabels ?? {}), ...cleared },
    }));
  }, [rawLabelsForSave, visibleKeys]);

  return {
    visibleKeys,
    columnLabels,
    setVisibleKeys,
    setLabel,
    resetLabels,
    isLoading: prefsQuery.isLoading && !prefsQuery.data,
    isSaving,
    saveError,
  };
}
