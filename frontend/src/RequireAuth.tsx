import { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth';

export default function RequireAuth({ children }: PropsWithChildren) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="app-loading-inner">Загрузка…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!user.onboarding_completed && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  // Администратор после онбординга видит только панель, ленту и каталог материалов
  if (user.onboarding_completed && user.is_admin) {
    const allowed = ['/admin', '/feed', '/materials'];
    if (!allowed.includes(location.pathname)) {
      return <Navigate to="/admin" replace />;
    }
  }
  return children;
}

