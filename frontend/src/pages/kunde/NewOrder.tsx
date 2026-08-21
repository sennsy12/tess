import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  X,
  PackageOpen,
  BadgePercent,
  Send,
} from 'lucide-react';
import { Layout } from '../../components/Layout';
import { EmptyState } from '../../components/EmptyState';
import { catalogApi, ordersApi, productsApi } from '../../lib/api';
import type { CatalogProduct } from '../../lib/api/catalog';
import { catalogKeys } from '../../lib/queryKeys';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useCart } from '../../context/useCart';
import { getApiError } from '../../lib/apiErrors';

const PAGE_SIZE = 24;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(value);
}

/** Generates an idempotency key for a submission attempt. */
function newIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 32);
}

export function NewOrder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cart = useCart();

  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 300);
  const [varegruppe, setVaregruppe] = useState('');
  const [page, setPage] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [kundeordreref, setKundeordreref] = useState('');
  const [kunderef, setKunderef] = useState('');

  const filtersKey = useMemo(
    () => ({ search: search.trim(), varegruppe }),
    [search, varegruppe],
  );

  const catalogQuery = useQuery({
    queryKey: catalogKeys.list(page, filtersKey, null, null),
    queryFn: async () => {
      const res = await catalogApi.getAll({
        page,
        limit: PAGE_SIZE,
        ...filtersKey,
      });
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  const productGroupsQuery = useQuery({
    queryKey: ['kunde', 'product-groups'],
    queryFn: async () => {
      const res = await productsApi.getGroups();
      return (res.data ?? []) as string[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await ordersApi.create({
        items: cart.items.map((i) => ({ varekode: i.varekode, antall: i.antall })),
        kundeordreref: kundeordreref.trim() || undefined,
        kunderef: kunderef.trim() || undefined,
        idempotencyKey: newIdempotencyKey(),
      });
      return res.data;
    },
    onSuccess: (data) => {
      cart.clear();
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['kunde', 'orders'] });
      toast.success(`Ordre #${data.ordrenr} sendt til godkjenning`);
      navigate(`/kunde/orders/${data.ordrenr}`);
    },
    onError: (err) => {
      toast.error(getApiError(err, 'Kunne ikke sende bestilling'));
    },
  });

  const products = catalogQuery.data?.data ?? [];
  const pagination = catalogQuery.data?.pagination;
  const totalPages = Math.max(1, Math.ceil((pagination?.total ?? 0) / PAGE_SIZE));

  const handleAdd = (product: CatalogProduct) => {
    if (cart.items.length >= 200 && !cart.items.some((i) => i.varekode === product.varekode)) {
      toast.error('Maks 200 linjer per bestilling');
      return;
    }
    cart.addItem(product);
  };

  const cartPanel = (
    <CartPanel
      onCheckout={() => {
        setCartOpen(false);
        setConfirmOpen(true);
      }}
    />
  );

  return (
    <Layout title="Ny bestilling">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
        {/* Catalog */}
        <div className="space-y-4 min-w-0">
          <div className="card p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" aria-hidden />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                placeholder="Søk etter varekode eller varenavn…"
                className="input pl-9 w-full"
                aria-label="Søk i produktkatalog"
              />
            </div>
            <select
              className="input sm:w-56"
              value={varegruppe}
              onChange={(e) => {
                setVaregruppe(e.target.value);
                setPage(1);
              }}
              aria-label="Filtrer på varegruppe"
            >
              <option value="">Alle varegrupper</option>
              {(productGroupsQuery.data ?? []).map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {catalogQuery.isError ? (
            <EmptyState
              icon={<PackageOpen className="h-10 w-10" aria-hidden />}
              title="Kunne ikke laste produkter"
              description={getApiError(catalogQuery.error, 'Prøv igjen senere.')}
              action={
                <button type="button" className="btn-secondary" onClick={() => void catalogQuery.refetch()}>
                  Prøv igjen
                </button>
              }
            />
          ) : products.length === 0 && !catalogQuery.isLoading ? (
            <EmptyState
              icon={<Search className="h-10 w-10" aria-hidden />}
              title="Ingen produkter funnet"
              description="Prøv et annet søk eller en annen varegruppe."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {catalogQuery.isLoading || catalogQuery.isPlaceholderData
                ? Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="card p-4 space-y-3 animate-pulse">
                      <div className="h-5 w-24 bg-dark-700/60 rounded" />
                      <div className="h-4 w-full bg-dark-700/40 rounded" />
                      <div className="h-8 w-full bg-dark-700/30 rounded" />
                    </div>
                  ))
                : products.map((product) => (
                    <ProductCard
                      key={product.varekode}
                      product={product}
                      inCart={cart.items.find((i) => i.varekode === product.varekode)?.antall ?? 0}
                      onAdd={() => handleAdd(product)}
                    />
                  ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-dark-400">
              <span>
                Side {page} av {totalPages} · {pagination?.total ?? 0} produkter
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary px-3 py-1.5"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Forrige
                </button>
                <button
                  type="button"
                  className="btn-secondary px-3 py-1.5"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Neste
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Desktop cart */}
        <aside className="hidden xl:block sticky top-24 space-y-4">{cartPanel}</aside>

        {/* Mobile floating cart button */}
        <AnimatePresence>
          {cart.count > 0 && !cartOpen && (
            <motion.button
              type="button"
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              onClick={() => setCartOpen(true)}
              className="xl:hidden fixed bottom-20 lg:bottom-6 right-4 z-40 btn-primary rounded-full pl-4 pr-5 py-3 flex items-center gap-2"
            >
              <ShoppingCart className="h-5 w-5" aria-hidden />
              {cart.count} · {formatCurrency(cart.total)}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Mobile cart drawer */}
        <AnimatePresence>
          {cartOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 xl:hidden"
                onClick={() => setCartOpen(false)}
                role="presentation"
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-dark-900 border-l border-dark-800 z-50 overflow-y-auto xl:hidden"
                role="dialog"
                aria-label="Handlekurv"
              >
                <div className="flex items-center justify-between p-4 border-b border-dark-800 sticky top-0 bg-dark-900">
                  <h3 className="text-lg font-semibold">Handlekurv</h3>
                  <button
                    type="button"
                    onClick={() => setCartOpen(false)}
                    className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800"
                    aria-label="Lukk handlekurv"
                  >
                    <X className="h-5 w-5" aria-hidden />
                  </button>
                </div>
                <div className="p-4">{cartPanel}</div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Submit confirmation modal */}
      <AnimatePresence>
        {confirmOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => !submitMutation.isPending && setConfirmOpen(false)}
              role="presentation"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative card w-full max-w-lg max-h-[90vh] overflow-y-auto z-10"
              role="dialog"
              aria-modal="true"
              aria-label="Bekreft bestilling"
            >
              <h3 className="text-xl font-semibold mb-1">Bekreft bestilling</h3>
              <p className="text-sm text-dark-400 mb-4">
                {cart.items.length} linjer · Totalt{' '}
                <span className="text-green-400 font-semibold">{formatCurrency(cart.total)}</span>.
                Ordren sendes til godkjenning før den behandles.
              </p>

              <div className="space-y-3 mb-4 max-h-48 overflow-y-auto border border-dark-800 rounded-lg p-3">
                {cart.items.map((item) => (
                  <div key={item.varekode} className="flex justify-between text-sm">
                    <span className="truncate mr-2">
                      {item.antall} × {item.varenavn || item.varekode}
                    </span>
                    <span className="font-medium whitespace-nowrap">
                      {formatCurrency(item.unit_price * item.antall)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="label" htmlFor="kundeordreref">
                    Deres ordrenr / referanse
                  </label>
                  <input
                    id="kundeordreref"
                    className="input w-full"
                    value={kundeordreref}
                    onChange={(e) => setKundeordreref(e.target.value)}
                    maxLength={100}
                    placeholder="Valgfritt"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="kunderef">
                    Referanse
                  </label>
                  <input
                    id="kunderef"
                    className="input w-full"
                    value={kunderef}
                    onChange={(e) => setKunderef(e.target.value)}
                    maxLength={100}
                    placeholder="Valgfritt"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={submitMutation.isPending}
                  onClick={() => setConfirmOpen(false)}
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  className="btn-primary flex items-center gap-2"
                  disabled={submitMutation.isPending}
                  onClick={() => submitMutation.mutate()}
                >
                  {submitMutation.isPending ? (
                    <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden />
                  )}
                  {submitMutation.isPending ? 'Sender…' : 'Send bestilling'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
}

function ProductCard({
  product,
  inCart,
  onAdd,
}: {
  product: CatalogProduct;
  inCart: number;
  onAdd: () => void;
}) {
  const [qty, setQty] = useState(1);
  const hasDiscount = product.discount_applied && product.discount_percent != null;

  return (
    <div className="card p-4 flex flex-col gap-3 relative">
      {inCart > 0 && (
        <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-primary-600/20 text-primary-300 text-xs font-semibold">
          {inCart} i kurv
        </span>
      )}
      <div>
        <span className="font-mono text-xs text-dark-400">{product.varekode}</span>
        <h4 className="font-semibold leading-snug line-clamp-2">
          {product.varenavn || product.varekode}
        </h4>
        {product.varegruppe && (
          <span className="inline-block mt-1 px-2 py-0.5 bg-primary-600/20 text-primary-300 rounded text-xs">
            {product.varegruppe}
          </span>
        )}
      </div>

      <div className="mt-auto">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-green-400">{formatCurrency(product.unit_price)}</span>
          {hasDiscount && (
            <>
              <span className="text-sm text-dark-500 line-through">{formatCurrency(product.base_price)}</span>
              <span
                className="flex items-center gap-1 px-1.5 py-0.5 bg-green-600/20 text-green-300 rounded text-xs font-medium"
                title={product.applied_rule_name ?? undefined}
              >
                <BadgePercent className="h-3 w-3" aria-hidden />-{product.discount_percent}%
              </span>
            </>
          )}
        </div>
        {hasDiscount && product.applied_rule_name && (
          <p className="text-xs text-dark-500 mt-0.5 truncate" title={product.applied_rule_name}>
            {product.applied_rule_name}
          </p>
        )}

        <div className="flex gap-2 mt-3">
          <div className="flex items-center rounded-lg border border-dark-700 overflow-hidden">
            <button
              type="button"
              className="px-2 py-2 text-dark-400 hover:text-white hover:bg-dark-800 disabled:opacity-40"
              disabled={qty <= 1}
              onClick={() => setQty((q) => q - 1)}
              aria-label="Reduser antall"
            >
              <Minus className="h-3.5 w-3.5" aria-hidden />
            </button>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.min(1_000_000, parseInt(e.target.value, 10) || 1)))}
              className="w-14 bg-transparent text-center text-sm focus:outline-none"
              aria-label={`Antall ${product.varekode}`}
            />
            <button
              type="button"
              className="px-2 py-2 text-dark-400 hover:text-white hover:bg-dark-800"
              onClick={() => setQty((q) => Math.min(1_000_000, q + 1))}
              aria-label="Øk antall"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <button type="button" className="btn-primary flex-1 flex items-center justify-center gap-1.5" onClick={onAdd}>
            <ShoppingCart className="h-4 w-4" aria-hidden />
            Legg i kurv
          </button>
        </div>
      </div>
    </div>
  );
}

function CartPanel({ onCheckout }: { onCheckout: () => void }) {
  const cart = useCart();

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary-400" aria-hidden />
          Handlekurv
        </h3>
        {cart.items.length > 0 && (
          <button
            type="button"
            onClick={cart.clear}
            className="text-xs text-dark-400 hover:text-red-400 transition-colors"
          >
            Tøm
          </button>
        )}
      </div>

      {cart.items.length === 0 ? (
        <div className="text-center py-8">
          <ShoppingCart className="h-10 w-10 mx-auto text-dark-700 mb-2" aria-hidden />
          <p className="text-dark-400 text-sm">Handlekurven er tom.</p>
          <p className="text-dark-500 text-xs mt-1">Legg til produkter fra katalogen.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-2 mb-4 max-h-72 overflow-y-auto pr-1">
            {cart.items.map((item) => (
              <li key={item.varekode} className="flex items-center gap-2 bg-dark-800/50 rounded-lg p-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.varenavn || item.varekode}</p>
                  <p className="text-xs text-dark-400 font-mono">{item.varekode}</p>
                </div>
                <input
                  type="number"
                  min={1}
                  value={item.antall}
                  onChange={(e) => cart.setQuantity(item.varekode, parseInt(e.target.value, 10) || 0)}
                  className="w-16 input text-sm text-center px-1 py-1"
                  aria-label={`Antall for ${item.varekode}`}
                />
                <span className="text-sm font-semibold w-20 text-right whitespace-nowrap">
                  {formatCurrency(item.unit_price * item.antall)}
                </span>
                <button
                  type="button"
                  onClick={() => cart.removeItem(item.varekode)}
                  className="p-1.5 rounded text-dark-500 hover:text-red-400 hover:bg-dark-800"
                  aria-label={`Fjern ${item.varekode}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>

          <div className="border-t border-dark-800 pt-3 space-y-1 text-sm mb-4">
            <div className="flex justify-between text-dark-400">
              <span>Linjer</span>
              <span>{cart.items.length}</span>
            </div>
            <div className="flex justify-between font-semibold text-base">
              <span>Totalt (eks. mva)</span>
              <span className="text-green-400">{formatCurrency(cart.total)}</span>
            </div>
          </div>

          <button type="button" className="btn-primary w-full flex items-center justify-center gap-2" onClick={onCheckout}>
            <Send className="h-4 w-4" aria-hidden />
            Til bekreftelse
          </button>
        </>
      )}
    </div>
  );
}
