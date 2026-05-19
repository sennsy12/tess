import { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { customersApi, ordersApi, productsApi, usersApi } from '../lib/api';

type SearchResult = {
  id: string;
  type: 'order' | 'customer' | 'product' | 'user';
  label: string;
  path: string;
};

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

const RECENT_KEY = 'admin-search-recent';

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(path: string) {
  const prev = loadRecent().filter((p) => p !== path);
  localStorage.setItem(RECENT_KEY, JSON.stringify([path, ...prev].slice(0, 5)));
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const isAdmin = user?.role === 'admin';

  const runSearch = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setResults([]);
        return;
      }
      setIsSearching(true);
      const term = q.trim();
      const found: SearchResult[] = [];

      try {
        const orderRes = await ordersApi.getAll({ search: term, limit: 5, page: 1 });
        const orders = orderRes.data?.data ?? [];
        for (const o of orders) {
          found.push({
            id: `order-${o.ordrenr}`,
            type: 'order',
            label: `Ordre #${o.ordrenr} — ${o.kundenavn}`,
            path: isAdmin ? `/admin/orders/${o.ordrenr}` : `/kunde/orders/${o.ordrenr}`,
          });
        }
      } catch {
        /* ignore */
      }

      if (isAdmin) {
        try {
          const custRes = await customersApi.getAll();
          const customers = custRes.data?.data ?? custRes.data ?? [];
          const termLower = term.toLowerCase();
          const matched = customers.filter(
            (c: { kundenr: string; kundenavn?: string; navn?: string }) =>
              c.kundenr?.toLowerCase().includes(termLower) ||
              (c.kundenavn ?? c.navn ?? '').toLowerCase().includes(termLower),
          );
          for (const c of matched.slice(0, 5)) {
            found.push({
              id: `customer-${c.kundenr}`,
              type: 'customer',
              label: `Kunde ${c.kundenr} — ${c.kundenavn ?? c.navn ?? ''}`,
              path: `/admin/customers`,
            });
          }
        } catch {
          /* ignore */
        }

        try {
          const prodRes = await productsApi.getAll({ search: term, limit: 5 });
          const products = prodRes.data?.data ?? prodRes.data ?? [];
          for (const p of products.slice(0, 5)) {
            found.push({
              id: `product-${p.varekode}`,
              type: 'product',
              label: `Vare ${p.varekode} — ${p.varenavn ?? ''}`,
              path: `/admin/products`,
            });
          }
        } catch {
          /* ignore */
        }

        try {
          const userRes = await usersApi.getAll({ page: 1, limit: 20 });
          const users = userRes.data?.data ?? [];
          const matched = users.filter((u) =>
            u.username.toLowerCase().includes(term.toLowerCase()),
          );
          for (const u of matched.slice(0, 5)) {
            found.push({
              id: `user-${u.id}`,
              type: 'user',
              label: `Bruker ${u.username} (${u.role})`,
              path: `/admin/users`,
            });
          }
        } catch {
          /* ignore */
        }
      }

      setResults(found);
      setHighlightIndex(0);
      setIsSearching(false);
    },
    [isAdmin],
  );

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setHighlightIndex(0);
      return;
    }
    const t = setTimeout(() => runSearch(query), 300);
    return () => clearTimeout(t);
  }, [query, open, runSearch]);

  const selectResult = (r: SearchResult) => {
    saveRecent(r.path);
    navigate(r.path);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (results.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const r = results[highlightIndex];
        if (r) selectResult(r);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, results, highlightIndex, navigate]);

  if (!open || !isAdmin) return null;

  const typeLabel: Record<SearchResult['type'], string> = {
    order: 'Ordre',
    customer: 'Kunde',
    product: 'Produkt',
    user: 'Bruker',
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-[12vh]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-xl rounded-xl border border-dark-700 bg-dark-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Globalt søk"
      >
        <div className="border-b border-dark-800 p-4">
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søk ordre, kunder, produkter, brukere…"
            className="input w-full"
            aria-label="Søk"
            aria-activedescendant={results[highlightIndex] ? `search-result-${highlightIndex}` : undefined}
          />
          <p className="mt-2 text-xs text-dark-500">Ctrl+K · ↑↓ velg · Enter åpne</p>
        </div>
        <ul ref={listRef} className="max-h-80 overflow-y-auto p-2" role="listbox">
          {isSearching && <li className="px-3 py-2 text-sm text-dark-400">Søker…</li>}
          {!isSearching && query.length >= 2 && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-dark-400">Ingen treff</li>
          )}
          {results.map((r, index) => (
            <li key={r.id} id={`search-result-${index}`} role="option" aria-selected={index === highlightIndex}>
              <button
                type="button"
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  index === highlightIndex ? 'bg-primary-600/30 text-dark-50' : 'hover:bg-dark-800'
                }`}
                onClick={() => selectResult(r)}
                onMouseEnter={() => setHighlightIndex(index)}
              >
                <span className="text-xs text-primary-400 mr-2">{typeLabel[r.type]}</span>
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function useGlobalSearchShortcut(onOpen: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, onOpen]);
}
