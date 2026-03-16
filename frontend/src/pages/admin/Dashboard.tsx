import { Link } from 'react-router-dom';
import { GlobeAltIcon, TagIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';

const navItems = [
  { name: 'Domains', path: '/admin/domains', icon: GlobeAltIcon, description: 'Manage domain records' },
  { name: 'Registrars', path: '/admin/registrars', icon: BuildingOfficeIcon, description: 'Manage registrar providers' },
  { name: 'Tags', path: '/admin/tags', icon: TagIcon, description: 'Manage tags and labels' },
];

export default function Dashboard() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200 border border-gray-200 dark:border-gray-800"
          >
            <item.icon className="h-8 w-8 text-indigo-600 dark:text-indigo-400 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{item.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
