import { PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './auth';

export default function RequireAdmin({ children }: PropsWithChildren) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="app-loading-inner">Загрузка…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_admin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
