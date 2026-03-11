import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { reportsApi } from '../lib/api';
import type { SaveViewOptions, SavedViewRecord } from '../types/workspace';

const STORAGE_PREFIX = 'saved-views';

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

function isWorkspaceReport(scope: string, config: any): boolean {
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
  const [localViews, setLocalViews] = useState<SavedViewRecord<TState>[]>([]);
  const [sharedViews, setSharedViews] = useState<SavedViewRecord<TState>[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const userKey = user ? `${user.role}:${user.id ?? user.username}` : 'anonymous';
  const canUseShared = enabledShared && user?.role === 'admin';

  const loadLocalViews = useCallback(() => {
    try {
      const raw = localStorage.getItem(getStorageKey(scope, userKey));
      if (!raw) {
        setLocalViews([]);
        return;
      }
      const parsed = JSON.parse(raw) as SavedViewRecord<TState>[];
      setLocalViews(parsed.map((entry) => normalizeLocalEntry(scope, entry)));
    } catch {
      setLocalViews([]);
    }
  }, [scope, userKey]);

  const persistLocalViews = useCallback(
    (views: SavedViewRecord<TState>[]) => {
      localStorage.setItem(getStorageKey(scope, userKey), JSON.stringify(views));
      setLocalViews(views.map((entry) => normalizeLocalEntry(scope, entry)));
    },
    [scope, userKey],
  );

  const loadSharedViews = useCallback(async () => {
    if (!canUseShared) {
      setSharedViews([]);
      return;
    }

    try {
      const response = await reportsApi.getAll();
      const reports = Array.isArray(response.data?.data) ? response.data.data : [];
      const views = reports
        .filter((report: any) => isWorkspaceReport(scope, report.config))
        .map((report: any): SavedViewRecord<TState> => ({
          id: `shared-${report.id}`,
          name: report.name,
          scope,
          state: report.config.state as TState,
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
      setSharedViews(views);
    } catch {
      toast.error('Kunne ikke laste delte visninger');
      setSharedViews([]);
    }
  }, [canUseShared, scope]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      loadLocalViews();
      await loadSharedViews();
    } finally {
      setIsLoading(false);
    }
  }, [loadLocalViews, loadSharedViews]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
        await refresh();
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
    [canUseShared, localViews, persistLocalViews, refresh, scope, state, user],
  );

  const deleteView = useCallback(
    async (view: SavedViewRecord<TState>) => {
      if (view.source === 'shared' && view.remoteId) {
        await reportsApi.delete(view.remoteId);
        toast.success('Delt visning slettet');
        await refresh();
        return;
      }

      const nextLocal = localViews.filter((entry) => entry.id !== view.id);
      persistLocalViews(nextLocal);
      toast.success('Visning slettet');
    },
    [localViews, persistLocalViews, refresh],
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
    () => [...localViews, ...sharedViews],
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
