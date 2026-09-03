import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { toasterConfig } from './lib/toastConfig'

import { AuthProvider } from './context/AuthContext.tsx'
import { CartProvider } from './context/CartProvider.tsx'
import { ProtectedRoute } from './components/ProtectedRoute'
import { RouteErrorBoundary } from './components/RouteErrorBoundary'
import { isServerError, reportError } from './lib/observability'
import { Spinner } from './components/Spinner'

const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })))
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })))
const Help = lazy(() => import('./pages/Help').then((m) => ({ default: m.Help })))

const KundeDashboard = lazy(() => import('./pages/kunde/Dashboard').then((m) => ({ default: m.KundeDashboard })))
const KundeOrders = lazy(() => import('./pages/kunde/Orders').then((m) => ({ default: m.KundeOrders })))
const KundeNewOrder = lazy(() => import('./pages/kunde/NewOrder').then((m) => ({ default: m.NewOrder })))
const KundeOrderDetail = lazy(() => import('./pages/kunde/OrderDetail').then((m) => ({ default: m.KundeOrderDetail })))
const KundePricing = lazy(() => import('./pages/kunde/Pricing').then((m) => ({ default: m.KundePricing })))
const KundeNotifications = lazy(() => import('./pages/kunde/Notifications').then((m) => ({ default: m.KundeNotifications })))
const KundeAccount = lazy(() => import('./pages/kunde/Account').then((m) => ({ default: m.KundeAccount })))
const AdvancedAnalytics = lazy(() => import('./pages/kunde/AdvancedAnalytics').then((m) => ({ default: m.AdvancedAnalytics })))
const KundeStatistics = lazy(() => import('./pages/kunde/Statistics').then((m) => ({ default: m.KundeStatistics })))

const AnalyseDashboard = lazy(() => import('./pages/analyse/Dashboard').then((m) => ({ default: m.AnalyseDashboard })))
const AnalyseStatistics = lazy(() => import('./pages/analyse/Statistics').then((m) => ({ default: m.AnalyseStatistics })))

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard').then((m) => ({ default: m.AdminDashboard })))
const AdminApprovals = lazy(() => import('./pages/admin/Approvals').then((m) => ({ default: m.AdminApprovals })))
const AdminOrderLines = lazy(() => import('./pages/admin/OrderLines').then((m) => ({ default: m.AdminOrderLines })))
const AdminStatus = lazy(() => import('./pages/admin/Status').then((m) => ({ default: m.AdminStatus })))
const AdminETL = lazy(() => import('./pages/admin/ETL').then((m) => ({ default: m.AdminETL })))
const AdminPricing = lazy(() => import('./pages/admin/pricing').then((m) => ({ default: m.AdminPricing })))
const AdminStatistics = lazy(() => import('./pages/admin/Statistics').then((m) => ({ default: m.AdminStatistics })))
const AdminOrders = lazy(() => import('./pages/admin/Orders').then((m) => ({ default: m.AdminOrders })))
const AdminOrderDetail = lazy(() => import('./pages/admin/OrderDetail').then((m) => ({ default: m.AdminOrderDetail })))
const AdminAdvancedAnalytics = lazy(() => import('./pages/admin/AdvancedAnalytics').then((m) => ({ default: m.AdminAdvancedAnalytics })))
const AdminUsers = lazy(() => import('./pages/admin/Users').then((m) => ({ default: m.AdminUsers })))
const AdminCustomers = lazy(() => import('./pages/admin/Customers').then((m) => ({ default: m.AdminCustomers })))
const AdminProducts = lazy(() => import('./pages/admin/Products').then((m) => ({ default: m.AdminProducts })))
const AdminAudit = lazy(() => import('./pages/admin/Audit').then((m) => ({ default: m.AdminAudit })))
const AdminNotifications = lazy(() => import('./pages/admin/Notifications').then((m) => ({ default: m.AdminNotifications })))

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (isServerError(error) && !('isAxiosError' in error)) {
        reportError(error, { source: 'react-query' })
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950">
      <Spinner size="lg" className="text-primary-500" label="Laster…" />
    </div>
  )
}

function ProtectedLayout({ allowedRoles }: { allowedRoles: string[] }) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </ProtectedRoute>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
          <MotionConfig reducedMotion="user">
          <RouteErrorBoundary>
          <Toaster {...toasterConfig} />
          <Routes>
          <Route path="/login" element={
            <Suspense fallback={<PageLoader />}>
              <Login />
            </Suspense>
          } />

          <Route element={<ProtectedLayout allowedRoles={['kunde', 'analyse', 'admin']} />}>
            <Route path="/hjelp" element={<Help />} />
          </Route>

          <Route element={<ProtectedLayout allowedRoles={['kunde', 'admin']} />}>
            <Route path="/kunde" element={<KundeDashboard />} />
            <Route path="/kunde/order/new" element={<KundeNewOrder />} />
            <Route path="/kunde/orders" element={<KundeOrders />} />
            <Route path="/kunde/orders/:ordrenr" element={<KundeOrderDetail />} />
            <Route path="/kunde/konto" element={<KundeAccount />} />
            <Route path="/kunde/pricing" element={<KundePricing />} />
            <Route path="/kunde/analytics" element={<AdvancedAnalytics />} />
            <Route path="/kunde/statistics" element={<KundeStatistics />} />
            <Route path="/kunde/varsler" element={<KundeNotifications />} />
            <Route path="/kunde/settings" element={<Settings />} />
          </Route>

          <Route element={<ProtectedLayout allowedRoles={['analyse', 'admin']} />}>
            <Route path="/analyse" element={<AnalyseDashboard />} />
            <Route path="/analyse/statistics" element={<AnalyseStatistics />} />
            <Route path="/analyse/settings" element={<Settings />} />
          </Route>

          <Route element={<ProtectedLayout allowedRoles={['admin']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/approvals" element={<AdminApprovals />} />
            <Route path="/admin/orderlines" element={<AdminOrderLines />} />
            <Route path="/admin/status" element={<AdminStatus />} />
            <Route path="/admin/etl" element={<AdminETL />} />
            <Route path="/admin/pricing" element={<AdminPricing />} />
            <Route path="/admin/statistics" element={<AdminStatistics />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/orders/:ordrenr" element={<AdminOrderDetail />} />
            <Route path="/admin/analytics" element={<AdminAdvancedAnalytics />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/customers" element={<AdminCustomers />} />
            <Route path="/admin/products" element={<AdminProducts />} />
            <Route path="/admin/audit" element={<AdminAudit />} />
            <Route path="/admin/varsler" element={<AdminNotifications />} />
            <Route path="/admin/settings" element={<Settings />} />
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          </RouteErrorBoundary>
          </MotionConfig>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
