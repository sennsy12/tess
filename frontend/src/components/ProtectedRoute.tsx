import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { Spinner } from './Spinner';

interface ProtectedRouteProps {
  allowedRoles: string[];
  children?: React.ReactNode;
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <Spinner size="lg" className="text-primary-500" label="Laster…" />
      </div>
    );
  }

  if (!user || !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    if (user.role === 'admin') {
      return <Navigate to="/admin" replace />;
    } else if (user.role === 'kunde') {
      return <Navigate to="/kunde" replace />;
    } else if (user.role === 'analyse') {
      return <Navigate to="/analyse" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
