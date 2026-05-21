import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext.tsx'
import { ProtectedRoute } from './components/ProtectedRoute'
import { RouteErrorBoundary } from './components/RouteErrorBoundary'

const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })))
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })))

const KundeDashboard = lazy(() => import('./pages/kunde/Dashboard').then((m) => ({ default: m.KundeDashboard })))
const KundeOrders = lazy(() => import('./pages/kunde/Orders').then((m) => ({ default: m.KundeOrders })))
const KundeOrderDetail = lazy(() => import('./pages/kunde/OrderDetail').then((m) => ({ default: m.KundeOrderDetail })))
const KundePricing = lazy(() => import('./pages/kunde/Pricing').then((m) => ({ default: m.KundePricing })))
const KundeAccount = lazy(() => import('./pages/kunde/Account').then((m) => ({ default: m.KundeAccount })))
const AdvancedAnalytics = lazy(() => import('./pages/kunde/AdvancedAnalytics').then((m) => ({ default: m.AdvancedAnalytics })))
const KundeStatistics = lazy(() => import('./pages/kunde/Statistics').then((m) => ({ default: m.KundeStatistics })))

const AnalyseDashboard = lazy(() => import('./pages/analyse/Dashboard').then((m) => ({ default: m.AnalyseDashboard })))
const AnalyseStatistics = lazy(() => import('./pages/analyse/Statistics').then((m) => ({ default: m.AnalyseStatistics })))

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard').then((m) => ({ default: m.AdminDashboard })))
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

const queryClient = new QueryClient({
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
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <RouteErrorBoundary>
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1e1e2e',
                color: '#e2e8f0',
                border: '1px solid #2d2d3f',
              },
              success: {
                duration: 4000,
                iconTheme: { primary: '#10b981', secondary: '#1e1e2e' },
              },
              error: {
                duration: 5000,
                iconTheme: { primary: '#ef4444', secondary: '#1e1e2e' },
              },
            }}
          />
          <Suspense fallback={<PageLoader />}>
          <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/kunde" element={
            <ProtectedRoute allowedRoles={['kunde', 'admin']}>
              <KundeDashboard />
            </ProtectedRoute>
          } />
          <Route path="/kunde/orders" element={
            <ProtectedRoute allowedRoles={['kunde', 'admin']}>
              <KundeOrders />
            </ProtectedRoute>
          } />
          <Route path="/kunde/orders/:ordrenr" element={
            <ProtectedRoute allowedRoles={['kunde', 'admin']}>
              <KundeOrderDetail />
            </ProtectedRoute>
          } />
          <Route path="/kunde/konto" element={
            <ProtectedRoute allowedRoles={['kunde', 'admin']}>
              <KundeAccount />
            </ProtectedRoute>
          } />
          <Route path="/kunde/pricing" element={
            <ProtectedRoute allowedRoles={['kunde', 'admin']}>
              <KundePricing />
            </ProtectedRoute>
          } />
          <Route path="/kunde/analytics" element={
            <ProtectedRoute allowedRoles={['kunde', 'admin']}>
              <AdvancedAnalytics />
            </ProtectedRoute>
          } />
          <Route path="/kunde/statistics" element={
            <ProtectedRoute allowedRoles={['kunde', 'admin']}>
              <KundeStatistics />
            </ProtectedRoute>
          } />
          <Route path="/kunde/settings" element={
            <ProtectedRoute allowedRoles={['kunde', 'admin']}>
              <Settings />
            </ProtectedRoute>
          } />
          
          <Route path="/analyse" element={
            <ProtectedRoute allowedRoles={['analyse', 'admin']}>
              <AnalyseDashboard />
            </ProtectedRoute>
          } />
          <Route path="/analyse/statistics" element={
            <ProtectedRoute allowedRoles={['analyse', 'admin']}>
              <AnalyseStatistics />
            </ProtectedRoute>
          } />
          <Route path="/analyse/settings" element={
            <ProtectedRoute allowedRoles={['analyse', 'admin']}>
              <Settings />
            </ProtectedRoute>
          } />
          
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/orderlines" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminOrderLines />
            </ProtectedRoute>
          } />
          <Route path="/admin/status" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminStatus />
            </ProtectedRoute>
          } />
          <Route path="/admin/etl" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminETL />
            </ProtectedRoute>
          } />
          <Route path="/admin/pricing" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminPricing />
            </ProtectedRoute>
          } />
          <Route path="/admin/statistics" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminStatistics />
            </ProtectedRoute>
          } />
          <Route path="/admin/orders" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminOrders />
            </ProtectedRoute>
          } />
          <Route path="/admin/orders/:ordrenr" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminOrderDetail />
            </ProtectedRoute>
          } />
          <Route path="/admin/analytics" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminAdvancedAnalytics />
            </ProtectedRoute>
          } />
          <Route path="/admin/users" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminUsers />
            </ProtectedRoute>
          } />
          <Route path="/admin/customers" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminCustomers />
            </ProtectedRoute>
          } />
          <Route path="/admin/products" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminProducts />
            </ProtectedRoute>
          } />
          <Route path="/admin/audit" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminAudit />
            </ProtectedRoute>
          } />
          <Route path="/admin/settings" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Settings />
            </ProtectedRoute>
          } />
          
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          </Suspense>
          </RouteErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
