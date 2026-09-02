import { useMemo, useState } from 'react';
import type { SavedViewRecord } from '../types/workspace';

interface SavedViewsPanelProps<TState> {
  title?: string;
  description?: string;
  views: SavedViewRecord<TState>[];
  isLoading?: boolean;
  canShare?: boolean;
  onApply: (view: SavedViewRecord<TState>) => void;
  onSave: (name: string, options?: { isDefault?: boolean; isShared?: boolean }) => Promise<void> | void;
  onDelete: (view: SavedViewRecord<TState>) => Promise<void> | void;
  onSetDefault: (viewId: string) => void;
}

export function SavedViewsPanel<TState>({
  title = 'Lagrede visninger',
  description,
  views,
  isLoading = false,
  canShare = false,
  onApply,
  onSave,
  onDelete,
  onSetDefault,
}: SavedViewsPanelProps<TState>) {
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const groupedViews = useMemo(
    () => ({
      defaultView: views.find((view) => view.isDefault),
      localViews: views.filter((view) => view.source === 'local' && !view.isDefault),
      sharedViews: views.filter((view) => view.source === 'shared'),
    }),
    [views],
  );

  const handleSave = async () => {
    if (!name.trim()) return;
    await onSave(name, { isDefault, isShared });
    setName('');
    setIsDefault(false);
    setIsShared(false);
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-lg">{title}</h3>
          {description && isOpen && <p className="text-sm text-dark-400 mt-1">{description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-wider text-dark-500">
            {views.length} visninger
          </span>
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
            className="btn-secondary text-sm px-3 py-1.5"
          >
            {isOpen ? 'Lukk' : 'Åpne'}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-4">
          <div className="space-y-3 mb-4">
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Navn på arbeidsflate"
              aria-label="Navn på arbeidsflate"
              className="input"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSave();
                }
              }}
            />
            <div className="flex flex-wrap gap-3 text-sm text-dark-300">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(event) => setIsDefault(event.target.checked)}
                />
                Sett som standard
              </label>
              {canShare && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isShared}
                    onChange={(event) => setIsShared(event.target.checked)}
                  />
                  Del med admin-teamet
                </label>
              )}
            </div>
            <button onClick={() => void handleSave()} className="btn-primary w-full sm:w-auto">
              Lagre visning
            </button>
          </div>

          {isLoading ? (
            <p className="text-sm text-dark-400">Laster visninger...</p>
          ) : views.length === 0 ? (
            <div className="rounded-xl border border-dashed border-dark-700 bg-dark-800/30 px-4 py-6 text-center text-dark-400">
              Ingen lagrede visninger ennå. Lagre filtre, sortering og kolonner for å komme raskere tilbake.
            </div>
          ) : (
            <div className="space-y-4">
              {groupedViews.defaultView && (
                <SavedViewCard
                  view={groupedViews.defaultView}
                  emphasized
                  onApply={onApply}
                  onDelete={onDelete}
                  onSetDefault={onSetDefault}
                />
              )}

              {groupedViews.localViews.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-dark-500">Mine visninger</p>
                  {groupedViews.localViews.map((view) => (
                    <SavedViewCard
                      key={view.id}
                      view={view}
                      onApply={onApply}
                      onDelete={onDelete}
                      onSetDefault={onSetDefault}
                    />
                  ))}
                </div>
              )}

              {groupedViews.sharedViews.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-dark-500">Delte admin-visninger</p>
                  {groupedViews.sharedViews.map((view) => (
                    <SavedViewCard
                      key={view.id}
                      view={view}
                      onApply={onApply}
                      onDelete={onDelete}
                      onSetDefault={onSetDefault}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SavedViewCard<TState>({
  view,
  emphasized = false,
  onApply,
  onDelete,
  onSetDefault,
}: {
  view: SavedViewRecord<TState>;
  emphasized?: boolean;
  onApply: (view: SavedViewRecord<TState>) => void;
  onDelete: (view: SavedViewRecord<TState>) => Promise<void> | void;
  onSetDefault: (viewId: string) => void;
}) {
  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        emphasized
          ? 'border-primary-500/40 bg-primary-500/10'
          : 'border-dark-700 bg-dark-800/40 hover:bg-dark-800/70'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-dark-100 truncate">{view.name}</p>
            {view.isDefault && (
              <span className="rounded-full border border-primary-500/30 bg-primary-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary-300">
                Standard
              </span>
            )}
            {view.isShared && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300">
                Delt
              </span>
            )}
          </div>
          <p className="text-xs text-dark-500 mt-1">
            {view.owner.username} · {new Date(view.updatedAt).toLocaleString('nb-NO')}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {!view.isDefault && view.source === 'local' && (
            <button
              onClick={() => onSetDefault(view.id)}
              className="rounded-lg px-2.5 py-1 text-xs text-dark-300 hover:bg-dark-700"
            >
              Standard
            </button>
          )}
          <button
            onClick={() => onApply(view)}
            className="rounded-lg bg-dark-700 px-2.5 py-1 text-xs text-dark-100 hover:bg-dark-600"
          >
            Bruk
          </button>
          <button
            onClick={() => void onDelete(view)}
            className="rounded-lg px-2.5 py-1 text-xs text-red-300 hover:bg-red-500/10"
          >
            Slett
          </button>
        </div>
      </div>
    </div>
  );
}
