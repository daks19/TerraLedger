'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/components/Providers';
import {
  MagnifyingGlassIcon,
  DocumentTextIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  FunnelIcon,
  ExclamationTriangleIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

interface Parcel {
  id: string;
  parcelId: string;
  surveyNumber: string;
  areaSqM: number;
  village: string;
  district: string;
  state: string;
  status: string;
  verificationStatus: string;
  createdAt: string;
  owner?: {
    name: string;
    email: string;
  };
}

export default function AdminParcelsPage() {
  const { user } = useAuth();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const isAdmin = user?.roles?.includes('ADMIN') || user?.roles?.includes('GOVERNMENT_OFFICIAL');

  useEffect(() => {
    fetchAllParcels();
  }, []);

  const fetchAllParcels = async () => {
    try {
      const token = sessionStorage.getItem('accessToken');
      // Fetch all parcels (admin endpoint)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/land/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        setParcels(data);
      }
    } catch (error) {
      console.error('Failed to fetch parcels:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredParcels = parcels.filter(parcel => {
    const matchesSearch = 
      parcel.parcelId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      parcel.surveyNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      parcel.village.toLowerCase().includes(searchTerm.toLowerCase()) ||
      parcel.district.toLowerCase().includes(searchTerm.toLowerCase()) ||
      parcel.owner?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || parcel.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
            <ExclamationTriangleIcon className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
            <p className="text-slate-400">Only administrators can access this page.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Manage All Parcels</h1>
            <p className="text-slate-400">View and manage all registered land parcels in the system</p>
          </div>
          <Link
            href="/dashboard/admin/register"
            className="mt-4 md:mt-0 inline-flex items-center px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all duration-300 hover:scale-[1.02] glow-emerald font-bold"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            Register New Land
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-1">Total Parcels</div>
            <div className="text-2xl font-bold text-white">{parcels.length}</div>
          </div>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-1">Verified</div>
            <div className="text-2xl font-bold text-green-400">
              {parcels.filter(p => p.status === 'VERIFIED').length}
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-1">Pending</div>
            <div className="text-2xl font-bold text-yellow-400">
              {parcels.filter(p => p.status === 'PENDING').length}
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-1">Disputed</div>
            <div className="text-2xl font-bold text-red-400">
              {parcels.filter(p => p.status === 'DISPUTED').length}
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by parcel ID, survey number, location, or owner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
            />
          </div>
          <div className="relative">
            <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="pl-10 pr-8 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300 appearance-none cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="VERIFIED">Verified</option>
              <option value="PENDING">Pending</option>
              <option value="DISPUTED">Disputed</option>
            </select>
          </div>
        </div>

        {/* Parcels Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 glow-emerald"></div>
          </div>
        ) : filteredParcels.length === 0 ? (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
            <DocumentTextIcon className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h3 className="text-xl font-semibold text-white mb-2">No Parcels Found</h3>
            <p className="text-slate-400 mb-6">
              {searchTerm ? 'No parcels match your search criteria.' : 'No parcels registered in the system.'}
            </p>
            <Link
              href="/dashboard/admin/register"
              className="inline-flex items-center px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all duration-300 hover:scale-[1.02] glow-emerald font-bold"
            >
              Register New Land
            </Link>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-6 py-4 text-slate-400 font-medium">Parcel ID</th>
                    <th className="text-left px-6 py-4 text-slate-400 font-medium">Survey No.</th>
                    <th className="text-left px-6 py-4 text-slate-400 font-medium">Location</th>
                    <th className="text-left px-6 py-4 text-slate-400 font-medium">Owner</th>
                    <th className="text-left px-6 py-4 text-slate-400 font-medium">Area</th>
                    <th className="text-left px-6 py-4 text-slate-400 font-medium">Status</th>
                    <th className="text-left px-6 py-4 text-slate-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredParcels.map((parcel) => (
                    <tr key={parcel.id} className="hover:bg-slate-700/50 transition">
                      <td className="px-6 py-4">
                        <span className="text-white font-mono">{parcel.parcelId}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-300">{parcel.surveyNumber}</td>
                      <td className="px-6 py-4">
                        <div className="text-white">{parcel.village}</div>
                        <div className="text-slate-400 text-sm">{parcel.district}, {parcel.state}</div>
                      </td>
                      <td className="px-6 py-4">
                        {parcel.owner ? (
                          <div>
                            <div className="text-white">{parcel.owner.name}</div>
                            <div className="text-slate-400 text-sm">{parcel.owner.email}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {(Number(parcel.areaSqM) * 10.764).toFixed(0).toLocaleString()} sq.ft
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          parcel.status === 'VERIFIED' ? 'bg-green-500/20 text-green-400' :
                          parcel.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                          parcel.status === 'DISPUTED' ? 'bg-red-500/20 text-red-400' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {parcel.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/parcels/${parcel.parcelId}`}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
                            title="View"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/dashboard/admin/edit/${parcel.parcelId}`}
                            className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded-lg transition-all duration-300"
                            title="Edit"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
