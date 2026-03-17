import { useEffect, useState } from 'react';
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
import { GlobeAltIcon, TagIcon, BuildingOfficeIcon, ArrowRightStartOnRectangleIcon, Cog6ToothIcon, BanknotesIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import api from './api/client';
import LanguageSwitcher from './components/LanguageSwitcher';
import { useI18n } from './i18n';

function AdminLayout() {
  const location = useLocation();
  const { t } = useI18n();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const navItems = [
    { name: t('nav.domains'), path: '/admin/domains', icon: GlobeAltIcon },
    { name: t('nav.currencies'), path: '/admin/currencies', icon: BanknotesIcon },
    { name: t('nav.registrars'), path: '/admin/registrars', icon: BuildingOfficeIcon },
    { name: t('nav.tags'), path: '/admin/tags', icon: TagIcon },
    { name: t('nav.settings'), path: '/admin/settings', icon: Cog6ToothIcon },
  ];

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      window.location.href = '/login';
    }
  };

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  const sidebar = (
    <aside className="flex h-full w-72 max-w-[85vw] flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-800">
        <div>
          <Link to="/" className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('app.name')}</Link>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('app.adminPanel')}</p>
          <div className="mt-3">
            <LanguageSwitcher />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileNavOpen(false)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 lg:hidden"
          aria-label="Close navigation"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
          {t('common.signOut')}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 lg:flex">
      <div className="hidden lg:block lg:shrink-0">
        {sidebar}
      </div>
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <button
            type="button"
            className="flex-1 bg-gray-950/50"
            onClick={() => setIsMobileNavOpen(false)}
            aria-label="Close navigation overlay"
          />
          <div className="relative z-10">
            {sidebar}
          </div>
        </div>
      )}
      <div className="flex-1">
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900 lg:hidden">
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            aria-label="Open navigation"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <Link to="/" className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('app.name')}</Link>
          <div className="w-10" />
        </div>
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
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
