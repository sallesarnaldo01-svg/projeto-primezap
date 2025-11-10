import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { Layout } from './layout/Layout';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, setLoading } = useAuthStore();
  const location = useLocation();
  const [forceRender, setForceRender] = useState(false);

  // Safety timeout: if loading takes more than 3 seconds, force it to false
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        console.warn('Auth loading timeout - forcing isLoading to false');
        setLoading(false);
        setForceRender(true);
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [isLoading, setLoading]);

  if (isLoading && !forceRender) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Layout>{children}</Layout>;
}
