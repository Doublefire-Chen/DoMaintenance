import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [allowRegister, setAllowRegister] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();

    api.get('/api/auth/me', { signal: controller.signal })
      .then(() => navigate('/admin'))
      .catch(() => {
        if (controller.signal.aborted) return;
        api.get('/api/auth/allow-register', { signal: controller.signal })
          .then((res) => setAllowRegister(res.data.allow_register === true))
          .catch(() => { })
          .finally(() => { if (!controller.signal.aborted) setChecking(false); });
      });

    return () => controller.abort();
  }, [navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/api/auth/login', { username, password });
      navigate('/admin');
    } catch {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Sign In</h1>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors duration-200"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {allowRegister && (
            <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
              Don't have an account?{' '}
              <Link to="/register" className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium">
                Create one
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
