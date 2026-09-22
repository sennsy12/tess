import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '../context/useAuth';
import { reportsApi } from '../lib/api/reports';
import { reportKeys } from '../lib/queryKeys';
import type { SaveViewOptions, SavedViewRecord } from '../types/workspace';

const STORAGE_PREFIX = 'saved-views';
/** Shared views endres sjelden — lang staleTime, ingen bakgrunnspolling. */
const SHARED_VIEWS_STALE_MS = 5 * 60_000;

function getStorageKey(scope: string, userKey: string) {
  return `${STORAGE_PREFIX}:${scope}:${userKey}`;
}

function normalizeLocalEntry<TState>(
  scope: string,
  raw: SavedViewRecord<TState>,
): SavedViewRecord<TState> {
  return {
    ...raw,
    scope,
    source: 'local',
    isShared: false,
  };
}

interface SharedReportRecord {
  id: number;
  name: string;
  config?: { __workspaceView?: boolean; scope?: string; state?: unknown };
  created_at: string;
  username?: string;
}

function isWorkspaceReport(
  scope: string,
  config: { __workspaceView?: boolean; scope?: string; state?: unknown } | undefined,
): boolean {
  return Boolean(config?.__workspaceView && config?.scope === scope && config?.state);
}

export function useSavedViews<TState>({
  scope,
  state,
  enabledShared = false,
}: {
  scope: string;
  state: TState;
  enabledShared?: boolean;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const userKey = user ? `${user.role}:${user.id ?? user.username}` : 'anonymous';
  const canUseShared = enabledShared && user?.role === 'admin';

  // Local views live in localStorage — hydrate in the state initializer (one
  // render, no setState-in-effect) instead of in a mount effect.
  const [localViews, setLocalViews] = useState<SavedViewRecord<TState>[]>(() => {
    try {
      const raw = localStorage.getItem(getStorageKey(scope, userKey));
      if (!raw) return [];
      const parsed = JSON.parse(raw) as SavedViewRecord<TState>[];
      return parsed.map((entry) => normalizeLocalEntry(scope, entry));
    } catch {
      return [];
    }
  });

  const persistLocalViews = useCallback(
    (views: SavedViewRecord<TState>[]) => {
      localStorage.setItem(getStorageKey(scope, userKey), JSON.stringify(views));
      setLocalViews(views.map((entry) => normalizeLocalEntry(scope, entry)));
    },
    [scope, userKey],
  );

  // Shared views are server data → React Query owns them (dedupe, cache,
  // invalidation). Every page that calls `useSavedViews` now shares ONE
  // `/reports` request instead of each firing its own on mount.
  const {
    data: sharedViews,
    isError: sharedViewsError,
    refetch: refetchSharedViews,
  } = useQuery<SavedViewRecord<TState>[]>({
    queryKey: reportKeys.all(),
    enabled: canUseShared,
    staleTime: SHARED_VIEWS_STALE_MS,
    queryFn: async () => {
      const response = await reportsApi.getAll();
      const reports = Array.isArray(response.data?.data)
        ? (response.data.data as SharedReportRecord[])
        : [];
      return reports
        .filter((report) => isWorkspaceReport(scope, report.config))
        .map((report): SavedViewRecord<TState> => ({
          id: `shared-${report.id}`,
          name: report.name,
          scope,
          state: report.config?.state as TState,
          isDefault: false,
          isShared: true,
          createdAt: report.created_at,
          updatedAt: report.created_at,
          owner: {
            username: report.username || 'Admin',
            role: 'admin',
          },
          source: 'shared',
          remoteId: report.id,
        }));
    },
  });

  // Keep the pre-query behaviour: surface load failures instead of hiding
  // them as an empty shared list.
  useEffect(() => {
    if (sharedViewsError) toast.error('Kunne ikke laste delte visninger');
  }, [sharedViewsError]);

  // Only the panel's first paint matters. A disabled query stays 'pending'
  // forever, so gate on canUseShared to never flash a loader for kunde/analyse.
  const isLoading = canUseShared ? sharedViews === undefined : false;

  const refresh = useCallback(async () => {
    if (canUseShared) await refetchSharedViews();
  }, [canUseShared, refetchSharedViews]);

  const saveView = useCallback(
    async (name: string, options?: SaveViewOptions) => {
      const trimmedName = name.trim();
      if (!trimmedName || !user) return;

      const now = new Date().toISOString();
      const baseView: SavedViewRecord<TState> = {
        id: `local-${crypto.randomUUID()}`,
        name: trimmedName,
        scope,
        state,
        isDefault: Boolean(options?.isDefault),
        isShared: false,
        createdAt: now,
        updatedAt: now,
        owner: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
        source: 'local',
      };

      if (options?.isShared && canUseShared) {
        await reportsApi.save(trimmedName, {
          __workspaceView: true,
          scope,
          state,
          shared: true,
        });
        toast.success('Delt visning lagret');
        // Invalidate instead of refetching the full list synchronously —
        // the next consumer mount (or this panel's next poll) reads fresh data.
        void queryClient.invalidateQueries({ queryKey: reportKeys.all() });
        return;
      }

      const nextLocal = [
        ...localViews.map((entry) => ({
          ...entry,
          isDefault: options?.isDefault ? false : entry.isDefault,
        })),
        baseView,
      ];

      persistLocalViews(nextLocal);
      toast.success(options?.isDefault ? 'Standardvisning lagret' : 'Visning lagret');
    },
    [canUseShared, localViews, persistLocalViews, queryClient, scope, state, user],
  );

  const deleteView = useCallback(
    async (view: SavedViewRecord<TState>) => {
      if (view.source === 'shared' && view.remoteId) {
        await reportsApi.delete(view.remoteId);
        toast.success('Delt visning slettet');
        void queryClient.invalidateQueries({ queryKey: reportKeys.all() });
        return;
      }

      const nextLocal = localViews.filter((entry) => entry.id !== view.id);
      persistLocalViews(nextLocal);
      toast.success('Visning slettet');
    },
    [localViews, persistLocalViews, queryClient],
  );

  const setDefaultView = useCallback(
    (viewId: string) => {
      const nextLocal = localViews.map((entry) => ({
        ...entry,
        isDefault: entry.id === viewId,
      }));
      persistLocalViews(nextLocal);
      toast.success('Standardvisning oppdatert');
    },
    [localViews, persistLocalViews],
  );

  const clearDefaultView = useCallback(() => {
    const nextLocal = localViews.map((entry) => ({
      ...entry,
      isDefault: false,
    }));
    persistLocalViews(nextLocal);
  }, [localViews, persistLocalViews]);

  const defaultView = useMemo(
    () => localViews.find((entry) => entry.isDefault),
    [localViews],
  );

  const allViews = useMemo(
    () => [...localViews, ...(sharedViews ?? [])],
    [localViews, sharedViews],
  );

  return {
    views: allViews,
    localViews,
    sharedViews,
    defaultView,
    canUseShared,
    isLoading,
    refresh,
    saveView,
    deleteView,
    setDefaultView,
    clearDefaultView,
  };
}
