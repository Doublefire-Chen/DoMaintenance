import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => {
    api.get('/api/auth/me')
      .then(() => setStatus('authenticated'))
      .catch(() => setStatus('unauthenticated'));
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
