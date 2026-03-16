import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusIcon } from '@heroicons/react/24/outline';
import api from '../../api/client';
import type { Registrar } from '../../types';

export default function RegistrarList() {
  const [registrars, setRegistrars] = useState<Registrar[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchRegistrars = () => {
    setLoading(true);
    api.get('/api/admin/registrars')
      .then((res) => setRegistrars(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRegistrars(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await api.delete(`/api/admin/registrars/${id}`);
      fetchRegistrars();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Registrars</h2>
        <Link
          to="/admin/registrars/new"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
        >
          <PlusIcon className="h-4 w-4" />
          Add Registrar
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Name</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Website</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {registrars.map((reg) => (
                <tr key={reg.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">{reg.name}</td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                    {reg.website ? (
                      <a href={reg.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                        {reg.website}
                      </a>
                    ) : '\u2014'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => navigate(`/admin/registrars/${reg.id}/edit`)} className="text-sm text-indigo-600 hover:text-indigo-800">Edit</button>
                      <button onClick={() => handleDelete(reg.id)} className="text-sm text-red-600 hover:text-red-800">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {registrars.length === 0 && (
            <div className="text-center py-12 text-gray-500">No registrars yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
