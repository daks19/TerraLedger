'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/components/Providers';
import {
  MapPinIcon,
  DocumentTextIcon,
  UserIcon,
  ClockIcon,
  ArrowLeftIcon,
  ShieldCheckIcon,
  ArrowsRightLeftIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface ParcelDetails {
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
  boundaryHash?: string;
  ipfsDocHash?: string;
  blockchainTxHash?: string;
  createdAt: string;
  updatedAt: string;
  owner?: {
    id: string;
    name: string;
    email: string;
    walletAddress: string;
    kycStatus: string;
  };
  previousOwners?: Array<{
    id: string;
    fromDate: string;
    toDate?: string;
    owner: { name: string; walletAddress: string };
  }>;
  transactions?: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: string;
    seller?: { name: string };
    buyer?: { name: string };
  }>;
}

export default function ParcelDetailPage() {
  const params = useParams();
  const parcelId = params.parcelId as string;
  const { user } = useAuth();
  
  const [parcel, setParcel] = useState<ParcelDetails | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = user?.roles?.includes('ADMIN') || user?.roles?.includes('GOVERNMENT_OFFICIAL');

  useEffect(() => {
    if (parcelId) {
      fetchParcelDetails();
    }
  }, [parcelId]);

  const fetchParcelDetails = async () => {
    try {
      const token = sessionStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/land/${parcelId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.status === 404) {
        setError('Parcel not found');
        return;
      }
      
      if (res.ok) {
        const data = await res.json();
        setParcel(data.parcel);
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('Failed to fetch parcel:', error);
      setError('Failed to load parcel details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8 flex flex-col items-center justify-center min-h-[60vh]">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl glow-emerald"></div>
            <div className="relative animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-400"></div>
          </div>
          <p className="mt-6 text-lg text-slate-400 animate-pulse">Loading property details...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !parcel) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          <div className="bg-slate-800/80 rounded-2xl border-2 border-red-500/30 p-8 text-center hover-lift">
            <div className="w-24 h-24 mx-auto mb-4 bg-red-500/10 rounded-full flex items-center justify-center border-2 border-red-500/30 glow-error">
              <ExclamationTriangleIcon className="w-12 h-12 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Parcel Not Found</h2>
            <p className="text-slate-400 mb-6">{error || `The parcel "${parcelId}" does not exist.`}</p>
            <Link href="/dashboard/parcels" className="inline-flex items-center px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all duration-300 hover:scale-105 glow-emerald font-semibold">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to Properties
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 relative">
        {/* Animated Background Particles */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              width: Math.random() * 3 + 1 + 'px',
              height: Math.random() * 3 + 1 + 'px',
              background: i % 2 === 0 ? '#10b981' : '#6366f1',
              bottom: '-10px',
              left: Math.random() * 100 + '%',
              animationDelay: Math.random() * 15 + 's',
              opacity: 0.3
            }}
          />
        ))}

        {/* Header */}
        <div className="mb-8 relative z-10">
          <Link href="/dashboard/parcels" className="inline-flex items-center text-slate-400 hover:text-emerald-400 mb-6 transition-all duration-300 hover:translate-x-[-4px] font-semibold">
            <ArrowLeftIcon className="w-5 h-5 mr-2" />
            Back to Properties
          </Link>
          
          {/* Hero Header Card */}
          <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-emerald-500/20 p-6 md:p-8 relative overflow-hidden glow-emerald hover-lift">
            {/* Glow orb */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl float"></div>
            <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl" style={{animationDelay: '2s'}}></div>
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-emerald-500/20 rounded-2xl flex items-center justify-center border-2 border-emerald-500/30 glow-emerald">
                  <MapPinIcon className="w-10 h-10 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-black text-white">{parcel.parcelId}</h1>
                    <span className={`px-3 py-1.5 text-sm font-bold rounded-lg border-2 ${
                      parcel.status === 'VERIFIED' ? 'bg-green-500/20 text-green-400 border-green-500/30 glow-success' :
                      parcel.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 glow-warning' :
                      parcel.status === 'DISPUTED' ? 'bg-red-500/20 text-red-400 border-red-500/30 glow-error' :
                      'bg-slate-500/20 text-slate-400 border-slate-500/30'
                    }`}>
                      {parcel.status}
                    </span>
                  </div>
                  <p className="text-slate-400 font-semibold">Survey No: <span className="text-emerald-400">{parcel.surveyNumber}</span></p>
                </div>
              </div>
              {isAdmin && (
                <Link
                  href={`/dashboard/admin/edit/${parcel.parcelId}`}
                  className="inline-flex items-center px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all duration-300 hover:scale-105 glow-emerald font-bold border border-emerald-400/30"
                >
                  Edit Property
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 relative z-10">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Location Details */}
            <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-emerald-500/20 p-6 transition-all duration-300 hover:border-emerald-500/40 hover-lift fade-in-up">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center mr-3 border border-emerald-500/30">
                  <MapPinIcon className="w-5 h-5 text-emerald-400" />
                </div>
                Location Details
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 hover:border-emerald-500/30 transition-all duration-300">
                  <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">Village/Town</div>
                  <div className="text-white font-bold text-lg">{parcel.village}</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 hover:border-emerald-500/30 transition-all duration-300">
                  <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">District</div>
                  <div className="text-white font-bold text-lg">{parcel.district}</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 hover:border-emerald-500/30 transition-all duration-300">
                  <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">State</div>
                  <div className="text-white font-bold text-lg">{parcel.state}</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 hover:border-emerald-500/30 transition-all duration-300">
                  <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">Area</div>
                  <div className="text-emerald-400 font-bold text-lg">{(parcel.areaSqM * 10.764).toFixed(0).toLocaleString()} sq.ft</div>
                  <div className="text-slate-500 text-sm">({(parcel.areaSqM / 10000).toFixed(2)} ha)</div>
                </div>
              </div>

              {/* Coordinates */}
              {parcel.latitude && parcel.longitude && (
                <div className="mt-4 bg-slate-900/50 p-4 rounded-xl border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300">
                  <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">GPS Coordinates</div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-mono text-sm font-bold">{parcel.latitude.toFixed(6)}°N</span>
                      <span className="text-slate-500">,</span>
                      <span className="text-emerald-400 font-mono text-sm font-bold">{parcel.longitude.toFixed(6)}°E</span>
                    </div>
                    <Link
                      href={`/dashboard/map?parcel=${parcel.parcelId}`}
                      className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-all duration-300 text-sm font-semibold"
                    >
                      <MapPinIcon className="w-4 h-4" />
                      View on Map
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Owner Details */}
            <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-cyan-500/20 p-6 transition-all duration-300 hover:border-cyan-500/40 hover-lift slide-in-left">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center mr-3 border border-cyan-500/30">
                  <UserIcon className="w-5 h-5 text-cyan-400" />
                </div>
                Current Owner
              </h2>
              {parcel.owner ? (
                <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-700/50">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center border-2 border-cyan-500/30 glow-cyan">
                      <UserIcon className="w-8 h-8 text-cyan-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-bold text-lg">{parcel.owner.name}</div>
                      <div className="text-slate-400 text-sm">{parcel.owner.email}</div>
                      <div className="text-cyan-400 text-xs font-mono mt-2 bg-slate-800/50 px-2 py-1 rounded inline-block">
                        {parcel.owner.walletAddress}
                      </div>
                    </div>
                    <div>
                      <span className={`px-3 py-1.5 text-sm font-bold rounded-lg border-2 ${
                        parcel.owner.kycStatus === 'VERIFIED' ? 'bg-green-500/20 text-green-400 border-green-500/30 glow-success' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 glow-warning'
                      }`}>
                        KYC: {parcel.owner.kycStatus}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400">No owner assigned</p>
              )}
            </div>

            {/* Documents & Verification */}
            <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl border-2 border-green-500/30 p-6 transition-all duration-300 hover:border-green-500/50 slide-in-right glow-success">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center mr-3 border border-green-500/30">
                  <ShieldCheckIcon className="w-5 h-5 text-green-400" />
                </div>
                Verification & Documents
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-4 px-4 bg-slate-900/50 rounded-xl border-l-4 border-green-500/50 hover:border-green-500 transition-all duration-300">
                  <span className="text-slate-300 font-semibold">Verification Status</span>
                  <span className={`px-3 py-1.5 text-sm font-bold rounded-lg border-2 ${
                    parcel.verificationStatus === 'VERIFIED' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                  }`}>
                    {parcel.verificationStatus}
                  </span>
                </div>
                {parcel.blockchainTxHash && (
                  <div className="flex items-center justify-between py-4 px-4 bg-slate-900/50 rounded-xl border-l-4 border-emerald-500/50 hover:border-emerald-500 transition-all duration-300">
                    <span className="text-slate-300 font-semibold">Blockchain TX</span>
                    <span className="text-emerald-400 font-mono text-sm bg-slate-800/50 px-3 py-1 rounded">
                      {parcel.blockchainTxHash.slice(0, 10)}...{parcel.blockchainTxHash.slice(-8)}
                    </span>
                  </div>
                )}
                {parcel.ipfsDocHash && (
                  <div className="flex items-center justify-between py-4 px-4 bg-slate-900/50 rounded-xl border-l-4 border-cyan-500/50 hover:border-cyan-500 transition-all duration-300">
                    <span className="text-slate-300 font-semibold">IPFS Documents</span>
                    <span className="text-cyan-400 font-mono text-sm bg-slate-800/50 px-3 py-1 rounded">
                      {parcel.ipfsDocHash.slice(0, 10)}...
                    </span>
                  </div>
                )}
                {parcel.boundaryHash && (
                  <div className="flex items-center justify-between py-4 px-4 bg-slate-900/50 rounded-xl border-l-4 border-blue-500/50 hover:border-blue-500 transition-all duration-300">
                    <span className="text-slate-300 font-semibold">Boundary Hash</span>
                    <span className="text-blue-400 font-mono text-sm bg-slate-800/50 px-3 py-1 rounded">
                      {parcel.boundaryHash.slice(0, 10)}...
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Ownership History */}
            {parcel.previousOwners && parcel.previousOwners.length > 0 && (
              <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-purple-500/20 p-6 transition-all duration-300 hover:border-purple-500/40">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center mr-3 border border-purple-500/30">
                    <ClockIcon className="w-5 h-5 text-purple-400" />
                  </div>
                  Ownership History
                </h2>
                <div className="space-y-3">
                  {parcel.previousOwners.map((prev, idx) => (
                    <div key={prev.id} className="flex items-center gap-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 hover:border-purple-500/30 transition-all duration-300 hover-lift">
                      <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400 font-bold border-2 border-purple-500/30">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-bold">{prev.owner?.name || 'Previous Owner'}</div>
                        <div className="text-purple-400 text-xs font-mono bg-slate-800/50 px-2 py-1 rounded inline-block mt-1">
                          {prev.owner?.walletAddress ? `${prev.owner.walletAddress.slice(0, 15)}...` : 'N/A'}
                        </div>
                      </div>
                      <div className="text-right text-sm text-slate-400 font-semibold">
                        {new Date(prev.fromDate).toLocaleDateString()} - {prev.toDate ? new Date(prev.toDate).toLocaleDateString() : 'Present'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Info */}
            <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-blue-500/20 p-6 hover:border-blue-500/40 transition-all duration-300 scale-in">
              <div className="flex items-center gap-2 mb-4">
                <ClockIcon className="w-6 h-6 text-blue-400" />
                <h3 className="text-lg font-bold text-white">Quick Info</h3>
              </div>
              <div className="space-y-4">
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                  <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Created</div>
                  <div className="text-white font-bold">{new Date(parcel.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                  <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Last Updated</div>
                  <div className="text-white font-bold">{new Date(parcel.updatedAt).toLocaleDateString()}</div>
                </div>
              </div>
            </div>

            {/* View on Map Button */}
            <Link
              href={`/dashboard/map?parcel=${parcel.parcelId}`}
              className="block w-full px-6 py-4 bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-400 rounded-xl hover:bg-emerald-500/30 hover:border-emerald-500 transition-all duration-300 hover:scale-[1.02] glow-emerald font-bold text-center flex items-center justify-center gap-3 group"
            >
              <MapPinIcon className="w-6 h-6 group-hover:scale-110 transition-transform duration-300" />
              View on Map
            </Link>

            {/* Recent Transactions */}
            <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-orange-500/20 p-6 hover:border-orange-500/40 transition-all duration-300">
              <div className="flex items-center gap-2 mb-4">
                <ArrowsRightLeftIcon className="w-6 h-6 text-orange-400" />
                <h3 className="text-lg font-bold text-white">Recent Transactions</h3>
              </div>
              {parcel.transactions && parcel.transactions.length > 0 ? (
                <div className="space-y-3">
                  {parcel.transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-700/50 hover:border-orange-500/30 transition-all duration-300 hover-lift">
                      <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center border border-orange-500/30">
                        <ArrowsRightLeftIcon className="w-5 h-5 text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-bold text-sm truncate">{tx.type}</div>
                        <div className="text-slate-400 text-xs">{new Date(tx.createdAt).toLocaleDateString()}</div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-bold rounded-lg border ${
                        tx.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                      }`}>
                        {tx.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-900/50 p-6 rounded-xl border-2 border-dashed border-slate-700/50 text-center">
                  <p className="text-slate-400 text-sm">No transactions yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
