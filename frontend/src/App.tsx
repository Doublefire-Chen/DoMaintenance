import { BrowserRouter, Routes, Route, Link, Navigate, useLocation, Outlet } from 'react-router-dom';
import PublicView from './pages/PublicView';
import Login from './pages/Login';
import Register from './pages/Register';
import DomainList from './pages/admin/DomainList';
import DomainForm from './pages/admin/DomainForm';
import Currencies from './pages/admin/Currencies';
import RegistrarList from './pages/admin/RegistrarList';
import RegistrarForm from './pages/admin/RegistrarForm';
import TagList from './pages/admin/TagList';
import TagForm from './pages/admin/TagForm';
import Settings from './pages/admin/Settings';
import ProtectedRoute from './components/ProtectedRoute';
import { GlobeAltIcon, TagIcon, BuildingOfficeIcon, ArrowRightStartOnRectangleIcon, Cog6ToothIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import api from './api/client';

function AdminLayout() {
  const location = useLocation();

  const navItems = [
    { name: 'Domains', path: '/admin/domains', icon: GlobeAltIcon },
    { name: 'Currencies', path: '/admin/currencies', icon: BanknotesIcon },
    { name: 'Registrars', path: '/admin/registrars', icon: BuildingOfficeIcon },
    { name: 'Tags', path: '/admin/tags', icon: TagIcon },
    { name: 'Settings', path: '/admin/settings', icon: Cog6ToothIcon },
  ];

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      window.location.href = '/login';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
      <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
          <Link to="/" className="text-lg font-bold text-gray-900 dark:text-gray-100">DoMaintenance</Link>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Admin Panel</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = item.path === '/admin'
              ? location.pathname === '/admin'
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${isActive
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 w-full transition-colors duration-200"
          >
            <ArrowRightStartOnRectangleIcon className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicView />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/domains" replace />} />
          <Route path="domains" element={<DomainList />} />
          <Route path="domains/new" element={<DomainForm />} />
          <Route path="domains/:id/edit" element={<DomainForm />} />
          <Route path="currencies" element={<Currencies />} />
          <Route path="registrars" element={<RegistrarList />} />
          <Route path="registrars/new" element={<RegistrarForm />} />
          <Route path="registrars/:id/edit" element={<RegistrarForm />} />
          <Route path="tags" element={<TagList />} />
          <Route path="tags/new" element={<TagForm />} />
          <Route path="tags/:id/edit" element={<TagForm />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
