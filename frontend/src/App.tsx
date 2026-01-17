import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Login } from './pages/Login'
import { KundeDashboard } from './pages/kunde/Dashboard'
import { KundeOrders } from './pages/kunde/Orders'
import { KundeOrderDetail } from './pages/kunde/OrderDetail'
import { AdvancedAnalytics } from './pages/kunde/AdvancedAnalytics'
import { AnalyseDashboard } from './pages/analyse/Dashboard'
import { AnalyseStatistics } from './pages/analyse/Statistics'
import { AdminDashboard } from './pages/admin/Dashboard'
import { AdminOrderLines } from './pages/admin/OrderLines'
import { AdminStatus } from './pages/admin/Status'
import { AdminETL } from './pages/admin/ETL'
import { AdminPricing } from './pages/admin/pricing'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Kunde routes */}
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
          <Route path="/kunde/analytics" element={
            <ProtectedRoute allowedRoles={['kunde', 'admin']}>
              <AdvancedAnalytics />
            </ProtectedRoute>
          } />
          
          {/* Analyse routes */}
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
          
          {/* Admin routes */}
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
          
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
