import { useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronDown, ClipboardList, Loader2, Plus, SearchX, Trash2 } from 'lucide-react';
import { catalogApi } from '../../lib/api';
import type { CatalogProduct } from '../../lib/api/catalog';
import { parseOrderPadInput } from '../../lib/orderPad';
import { useCart } from '../../context/useCart';

interface PadMatch {
  product: CatalogProduct;
  antall: number;
}

const PLACEHOLDER = ['ABC-100 12', 'DEF-200', '# én vare per linje, antall valgfritt'].join('\n');

export function OrderPad() {
  const cart = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [matches, setMatches] = useState<PadMatch[] | null>(null);
  const [notFoundCodes, setNotFoundCodes] = useState<string[]>([]);
  const [issueCount, setIssueCount] = useState(0);

  const hasInput = text.trim().length > 0;

  const handleResolve = async () => {
    const parsed = parseOrderPadInput(text);
    if (parsed.lines.length === 0) {
      setMatches(null);
      setNotFoundCodes([]);
      setIssueCount(parsed.issues.length);
      toast.error('Ingen gyldige linjer å slå opp');
      return;
    }

    setIsResolving(true);
    setMatches(null);
    setNotFoundCodes([]);
    setIssueCount(parsed.issues.length);

    try {
      const found: PadMatch[] = [];
      const missing: string[] = [];

      await Promise.all(
        parsed.lines.map(async (line) => {
          try {
            const response = await catalogApi.getAll({ search: line.varekode, limit: 25 });
            const code = line.varekode.toUpperCase();
            const product = (response.data.data ?? []).find(
              (candidate) => candidate.varekode.toUpperCase() === code,
            );
            if (product) {
              found.push({ product, antall: line.antall });
            } else {
              missing.push(line.varekode);
            }
          } catch {
            throw new Error('lookup-failed');
          }
        }),
      );

      found.sort((a, b) => a.product.varekode.localeCompare(b.product.varekode));
      setMatches(found);
      setNotFoundCodes(missing.sort((a, b) => a.localeCompare(b)));
    } catch {
      toast.error('Kunne ikke slå opp varene. Prøv igjen.');
    } finally {
      setIsResolving(false);
    }
  };

  const handleAddToCart = () => {
    if (!matches || matches.length === 0) return;
    for (const match of matches) {
      cart.addItem(match.product, match.antall);
    }
    const missingNote = notFoundCodes.length > 0 ? ` (${notFoundCodes.length} ikke funnet)` : '';
    toast.success(`${matches.length} varer lagt i handlekurven${missingNote}`);
    reset();
    setIsOpen(false);
  };

  const reset = () => {
    setText('');
    setMatches(null);
    setNotFoundCodes([]);
    setIssueCount(0);
  };

  return (
    <div className="card p-4">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2.5">
          <ClipboardList className="h-5 w-5 text-primary-400" aria-hidden />
          <span>
            <span className="block text-sm font-semibold text-dark-100">Hurtigbestilling</span>
            <span className="block text-xs text-dark-500">
              Lim inn en liste med varekoder og antall
            </span>
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-dark-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {isOpen && (
        <div className="mt-4 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={6}
            spellCheck={false}
            className="input w-full font-mono text-sm leading-relaxed"
            aria-label="Vareliste for hurtigbestilling"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleResolve()}
              disabled={!hasInput || isResolving}
              className="btn-secondary py-2 text-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {isResolving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <SearchX className="h-4 w-4" aria-hidden />
              )}
              Søk opp varer
            </button>
            {matches && matches.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="btn-primary py-2 text-sm flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Legg {matches.length} varer i kurven
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="btn-secondary py-2 text-sm flex items-center gap-1.5"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Nullstill
                </button>
              </>
            )}
          </div>

          {(issueCount > 0 || (notFoundCodes.length > 0 && matches !== null)) && (
            <div className="rounded-lg border border-dark-700 bg-dark-900/60 p-3 text-xs space-y-1.5">
              {issueCount > 0 && (
                <p className="text-yellow-400/90">
                  {issueCount} linjer kunne ikke tolkes og ble hoppet over.
                </p>
              )}
              {notFoundCodes.length > 0 && (
                <p className="text-dark-400">
                  Ikke funnet i katalogen:{' '}
                  <span className="font-mono text-dark-300">{notFoundCodes.join(', ')}</span>
                </p>
              )}
            </div>
          )}

          {matches && matches.length > 0 && (
            <ul className="divide-y divide-dark-800 rounded-lg border border-dark-800 bg-dark-900/40 text-sm">
              {matches.map((match) => (
                <li key={match.product.varekode} className="flex items-center justify-between px-3 py-2">
                  <span className="min-w-0">
                    <span className="font-mono text-xs text-dark-400">{match.product.varekode}</span>{' '}
                    <span className="truncate">{match.product.varenavn || match.product.varekode}</span>
                  </span>
                  <span className="flex items-baseline gap-3 whitespace-nowrap">
                    <span className="font-mono text-xs text-primary-300">×{match.antall}</span>
                    <span className="font-semibold">
                      {new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(
                        match.product.unit_price,
                      )}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
