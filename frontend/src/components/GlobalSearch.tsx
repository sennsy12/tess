import { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ClipboardList, Search } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { pricingApi, ordersApi, productsApi, usersApi } from '../lib/api';
import { ModalShell } from './ModalShell';

type SearchResult = {
  id: string;
  type: 'order' | 'customer' | 'product' | 'user';
  label: string;
  sublabel?: string;
  path: string;
};

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

function recentKey(role: string) {
  return role === 'kunde' ? 'kunde-search-recent' : 'admin-search-recent';
}

function loadRecent(role: string): string[] {
  try {
    const raw = localStorage.getItem(recentKey(role));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(role: string, path: string) {
  const prev = loadRecent(role).filter((p) => p !== path);
  localStorage.setItem(recentKey(role), JSON.stringify([path, ...prev].slice(0, 5)));
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const role = user?.role;
  const isAdmin = role === 'admin';
  const isKundeView = role === 'kunde' || (role === 'admin' && location.pathname.startsWith('/kunde'));
  const enabled = isAdmin || role === 'kunde';

  const orderBasePath = isKundeView ? '/kunde/orders' : '/admin/orders';

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
        const orderRes = await ordersApi.getAll({ search: term, limit: 8, page: 1 });
        const orders = orderRes.data?.data ?? [];
        for (const o of orders) {
          const refs = [o.kunderef, o.kundeordreref].filter(Boolean).join(' · ');
          found.push({
            id: `order-${o.ordrenr}`,
            type: 'order',
            label: `Ordre #${o.ordrenr}`,
            sublabel: refs || o.firmanavn || undefined,
            path: `${orderBasePath}/${o.ordrenr}`,
          });
        }
      } catch {
        /* ignore */
      }

      if (isAdmin && !isKundeView) {
        try {
          const custRes = await pricingApi.searchCustomers({ search: term, page: 1, limit: 5 });
          const customers = custRes.data?.data ?? [];
          for (const c of customers) {
            found.push({
              id: `customer-${c.kundenr}`,
              type: 'customer',
              label: `${c.kundenr} — ${c.kundenavn ?? ''}`,
              path: `/admin/customers`,
            });
          }
        } catch {
          /* ignore */
        }

        try {
          const prodRes = await productsApi.search({ search: term, page: 1, limit: 5 });
          const products = prodRes.data?.data ?? [];
          for (const p of products) {
            found.push({
              id: `product-${p.varekode}`,
              type: 'product',
              label: `${p.varekode} — ${p.varenavn ?? ''}`,
              path: `/admin/products`,
            });
          }
        } catch {
          /* ignore */
        }

        try {
          const userRes = await usersApi.search({ q: term, limit: 5 });
          const users = userRes.data?.data ?? [];
          for (const u of users) {
            found.push({
              id: `user-${u.id}`,
              type: 'user',
              label: `${u.username} (${u.role})`,
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
    [isAdmin, orderBasePath],
  );

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setHighlightIndex(0);
      return;
    }
    void runSearch(debouncedQuery);
  }, [debouncedQuery, open, runSearch]);

  const selectResult = (r: SearchResult) => {
    if (role) saveRecent(role, r.path);
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
  }, [open, onClose, results, highlightIndex, navigate, role]);

  if (!open || !enabled) return null;

  const typeLabel: Record<SearchResult['type'], string> = {
    order: 'Ordre',
    customer: 'Kunde',
    product: 'Produkt',
    user: 'Bruker',
  };

  const placeholder = isKundeView
    ? 'Søk ordrenr, referanse, firma…'
    : 'Søk ordre, kunder, produkter, brukere…';

  return (
    <ModalShell
      open={open && enabled}
      onClose={onClose}
      label={isKundeView ? 'Søk i dine ordrer' : 'Globalt søk'}
      maxWidth="max-w-xl"
      zIndex="z-[200]"
      align="top"
      className="card--flush max-h-[80vh] overflow-y-auto"
    >
      <div className="border-b border-dark-800 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-500 pointer-events-none" aria-hidden />
          <input
            type="search"
            data-autofocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="input w-full pl-10"
            aria-label="Søk"
            aria-activedescendant={results[highlightIndex] ? `search-result-${highlightIndex}` : undefined}
          />
        </div>
        <p className="mt-2 text-xs text-dark-500">
          {isKundeView ? 'Ctrl+K · kun dine ordrer' : 'Ctrl+K · ↑↓ velg · Enter åpne'}
        </p>
      </div>

      {query.length < 2 && isKundeView && (
        <div className="px-4 py-6 text-center text-sm text-dark-400">
          <ClipboardList className="h-8 w-8 mx-auto mb-2 text-dark-600" aria-hidden />
          Skriv minst 2 tegn for å søke blant ordrene dine
        </div>
      )}

      <ul ref={listRef} className="max-h-80 overflow-y-auto p-2" role="listbox">
        {isSearching && <li className="px-3 py-2 text-sm text-dark-400">Søker…</li>}
        {!isSearching && query.length >= 2 && results.length === 0 && (
          <li className="px-3 py-6 text-sm text-dark-400 text-center">Ingen treff</li>
        )}
          {results.map((r, index) => (
            <li
              key={r.id}
              id={`search-result-${index}`}
              role="option"
              aria-selected={index === highlightIndex}
              onClick={() => selectResult(r)}
              onMouseEnter={() => setHighlightIndex(index)}
              className={`rounded-xl px-3 py-2.5 transition-colors cursor-pointer ${
                index === highlightIndex ? 'bg-primary-600/25 text-dark-50' : 'hover:bg-dark-800'
              }`}
            >
              <span className="text-[10px] uppercase tracking-wider font-semibold text-primary-400 mr-2">
                {typeLabel[r.type]}
              </span>
              <span className="text-sm">{r.label}</span>
              {r.sublabel && (
                <span className="block text-xs text-dark-400 mt-0.5 truncate">{r.sublabel}</span>
              )}
            </li>
          ))}
      </ul>
    </ModalShell>
  );
}
