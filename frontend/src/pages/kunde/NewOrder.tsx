import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { PackageOpen, Search, ShoppingCart } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { EmptyState } from '../../components/EmptyState';
import { OrderPad } from '../../components/orders/OrderPad';
import type { CatalogProduct } from '../../lib/api/catalog';
import { getApiError } from '../../lib/apiErrors';
import { formatMoneyNok } from '../../lib/formatters';
import { useCart } from '../../context/useCart';
import { useCatalogBrowse } from '../../hooks/useCatalogBrowse';
import { useOrderSubmission } from '../../hooks/useOrderSubmission';
import { CartDrawer } from './components/newOrder/CartDrawer';
import { CartPanel } from './components/newOrder/CartPanel';
import { ConfirmOrderModal } from './components/newOrder/ConfirmOrderModal';
import { ProductCard } from './components/newOrder/ProductCard';

/** Hard limit matching the backend's order-line constraint. */
const MAX_CART_LINES = 200;

export function NewOrder() {
  const cart = useCart();
  const catalog = useCatalogBrowse();
  const [cartOpen, setCartOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const submission = useOrderSubmission(() => setConfirmOpen(false));

  const handleAdd = (product: CatalogProduct, qty = 1) => {
    if (cart.items.length >= MAX_CART_LINES && !cart.items.some((i) => i.varekode === product.varekode)) {
      toast.error(`Maks ${MAX_CART_LINES} linjer per bestilling`);
      return;
    }
    cart.addItem(product, qty);
  };

  const handleCheckout = () => {
    setCartOpen(false);
    setConfirmOpen(true);
  };

  const cartPanel = <CartPanel onCheckout={handleCheckout} />;

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
                value={catalog.searchInput}
                onChange={(e) => catalog.onSearchChange(e.target.value)}
                placeholder="Søk etter varekode eller varenavn…"
                className="input pl-9 w-full"
                aria-label="Søk i produktkatalog"
              />
            </div>
            <select
              className="input sm:w-56"
              value={catalog.varegruppe}
              onChange={(e) => catalog.onVaregruppeChange(e.target.value)}
              aria-label="Filtrer på varegruppe"
            >
              <option value="">Alle varegrupper</option>
              {catalog.groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <OrderPad />

          {catalog.catalogQuery.isError ? (
            <EmptyState
              icon={<PackageOpen className="h-10 w-10" aria-hidden />}
              title="Kunne ikke laste produkter"
              description={getApiError(catalog.catalogQuery.error, 'Prøv igjen senere.')}
              action={
                <button type="button" className="btn-secondary" onClick={() => void catalog.catalogQuery.refetch()}>
                  Prøv igjen
                </button>
              }
            />
          ) : catalog.products.length === 0 && !catalog.catalogQuery.isLoading ? (
            <EmptyState
              icon={<Search className="h-10 w-10" aria-hidden />}
              title="Ingen produkter funnet"
              description="Prøv et annet søk eller en annen varegruppe."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {catalog.catalogQuery.isLoading || catalog.catalogQuery.isPlaceholderData
                ? Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="card p-4 space-y-3 animate-pulse">
                      <div className="h-5 w-24 bg-dark-700/60 rounded" />
                      <div className="h-4 w-full bg-dark-700/40 rounded" />
                      <div className="h-8 w-full bg-dark-700/30 rounded" />
                    </div>
                  ))
                : catalog.products.map((product) => (
                    <ProductCard
                      key={product.varekode}
                      product={product}
                      inCart={cart.items.find((i) => i.varekode === product.varekode)?.antall ?? 0}
                      onAdd={(qty) => handleAdd(product, qty)}
                    />
                  ))}
            </div>
          )}

          {catalog.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-dark-400">
              <span>
                Side {catalog.page} av {catalog.totalPages} · {catalog.totalCount} produkter
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary px-3 py-1.5"
                  disabled={catalog.page <= 1}
                  onClick={() => catalog.setPage((p) => Math.max(1, p - 1))}
                >
                  Forrige
                </button>
                <button
                  type="button"
                  className="btn-secondary px-3 py-1.5"
                  disabled={catalog.page >= catalog.totalPages}
                  onClick={() => catalog.setPage((p) => Math.min(catalog.totalPages, p + 1))}
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
              {cart.count} · {formatMoneyNok(cart.total)}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Mobile cart drawer */}
        <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} onCheckout={handleCheckout} />
      </div>

      {/* Submit confirmation modal */}
      <ConfirmOrderModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => submission.submit()}
        isSubmitting={submission.isSubmitting}
        kundeordreref={submission.kundeordreref}
        onKundeordrerefChange={submission.onKundeordrerefChange}
        kunderef={submission.kunderef}
        onKunderefChange={submission.onKunderefChange}
      />
    </Layout>
  );
}
