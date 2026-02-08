'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/components/Providers';
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  DocumentTextIcon,
  EyeIcon,
  PencilIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

interface Parcel {
  id: string;
  parcelId: string;
  surveyNumber: string;
  areaSqM: number;
  village: string;
  district: string;
  state: string;
  latitude?: number;
  longitude?: number;
  status: string;
  verificationStatus: string;
  createdAt: string;
}

export default function ParcelsPage() {
  const { user } = useAuth();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const isAdmin = user?.roles?.includes('ADMIN') || user?.roles?.includes('GOVERNMENT_OFFICIAL');

  useEffect(() => {
    if (user) {
      fetchParcels();
    }
  }, [user, isAdmin]);

  const fetchParcels = async () => {
    try {
      const token = sessionStorage.getItem('accessToken');
      const endpoint = isAdmin ? '/api/land/all' : '/api/land/my-parcels';
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${endpoint}`, {
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
      parcel.district.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || parcel.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">My Properties</h1>
            <p className="text-slate-400">View and manage your registered land parcels</p>
          </div>
          {isAdmin && (
            <Link
              href="/dashboard/admin/register"
              className="mt-4 md:mt-0 inline-flex items-center px-5 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all duration-300 hover:scale-105 glow-emerald border border-emerald-400/30"
            >
              <DocumentTextIcon className="w-5 h-5 mr-2" />
              Register New Land
            </Link>
          )}
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by parcel ID, survey number, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
            />
          </div>
          <div className="relative">
            <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="pl-10 pr-8 py-3 bg-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer transition-colors"
            >
              <option value="all">All Status</option>
              <option value="VERIFIED">Verified</option>
              <option value="PENDING">Pending</option>
              <option value="DISPUTED">Disputed</option>
            </select>
          </div>
        </div>

        {/* Parcels List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 glow-emerald"></div>
          </div>
        ) : filteredParcels.length === 0 ? (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
            <DocumentTextIcon className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h3 className="text-xl font-semibold text-white mb-2">No Properties Found</h3>
            <p className="text-slate-400 mb-6">
              {searchTerm ? 'No properties match your search criteria.' : 'You don\'t have any registered properties yet.'}
            </p>
            {isAdmin && (
              <Link
                href="/dashboard/admin/register"
                className="inline-flex items-center px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all duration-300 hover:scale-[1.02] glow-emerald font-bold"
              >
                Register New Land
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredParcels.map((parcel) => (
              <div
                key={parcel.id}
                className="bg-slate-800 rounded-xl border border-slate-700 p-6 hover:border-slate-600 transition-all duration-300 hover:shadow-lg hover:scale-[1.01]"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">{parcel.parcelId}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        parcel.status === 'VERIFIED' ? 'bg-green-500/20 text-green-400' :
                        parcel.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                        parcel.status === 'DISPUTED' ? 'bg-red-500/20 text-red-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {parcel.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">Survey No:</span>
                        <span className="ml-2 text-white">{parcel.surveyNumber}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Area:</span>
                        <span className="ml-2 text-white">{(parcel.areaSqM * 10.764).toFixed(0).toLocaleString()} sq.ft</span>
                      </div>
                      <div className="flex items-center">
                        <MapPinIcon className="w-4 h-4 text-slate-400 mr-1" />
                        <span className="text-white">{parcel.village}, {parcel.district}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">State:</span>
                        <span className="ml-2 text-white">{parcel.state}</span>
                      </div>
                      {parcel.latitude && parcel.longitude && (
                        <div className="flex items-center">
                          <span className="text-slate-400 text-xs font-mono">{parcel.latitude.toFixed(4)}°N, {parcel.longitude.toFixed(4)}°E</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {parcel.latitude && parcel.longitude && (
                      <Link
                        href={`/dashboard/map?parcel=${parcel.parcelId}`}
                        className="inline-flex items-center px-3 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-all duration-200 hover:scale-105"
                        title="View on Map"
                      >
                        <MapPinIcon className="w-4 h-4" />
                      </Link>
                    )}
                    <Link
                      href={`/dashboard/parcels/${parcel.parcelId}`}
                      className="inline-flex items-center px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all duration-200 hover:scale-105"
                    >
                      <EyeIcon className="w-4 h-4 mr-2" />
                      View
                    </Link>
                    {isAdmin && (
                      <Link
                        href={`/dashboard/admin/edit/${parcel.parcelId}`}
                        className="inline-flex items-center px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-all duration-300 hover:scale-105 hover:glow-emerald"
                      >
                        <PencilIcon className="w-4 h-4 mr-2" />
                        Edit
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
