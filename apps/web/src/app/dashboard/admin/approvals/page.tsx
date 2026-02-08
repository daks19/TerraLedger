'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/components/Providers';
import {
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  UserIcon,
  MapPinIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface PendingParcel {
  id: string;
  parcelId: string;
  surveyNumber: string;
  areaSqM: number;
  village: string;
  district: string;
  state: string;
  registrationStatus: string;
  submittedAt: string;
  owner: {
    id: string;
    name: string;
    email: string;
    walletAddress: string;
    kycStatus: string;
  };
  submittedBy: {
    id: string;
    name: string;
    email: string;
  };
}

export default function ApprovalQueuePage() {
  const { user } = useAuth();
  const [parcels, setParcels] = useState<PendingParcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedParcel, setSelectedParcel] = useState<PendingParcel | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const isAdmin = user?.roles?.includes('ADMIN') || user?.roles?.includes('GOVERNMENT_OFFICIAL');

  useEffect(() => {
    if (isAdmin) {
      fetchPendingApprovals();
    }
  }, [isAdmin]);

  const fetchPendingApprovals = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/land/pending-approvals`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch pending approvals');
      }

      const data = await res.json();
      setParcels(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (parcelId: string) => {
    if (!confirm('Are you sure you want to approve this registration? It will be registered on the blockchain.')) {
      return;
    }

    setActionLoading(true);
    setError('');

    try {
      const token = sessionStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/land/approve/${parcelId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to approve registration');
      }

      alert('Registration approved successfully!');
      setSelectedParcel(null);
      fetchPendingApprovals();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (parcelId: string) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    setActionLoading(true);
    setError('');

    try {
      const token = sessionStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/land/reject/${parcelId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: rejectionReason }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reject registration');
      }

      alert('Registration rejected');
      setSelectedParcel(null);
      setRejectionReason('');
      fetchPendingApprovals();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
            <ExclamationTriangleIcon className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
            <p className="text-slate-400">Only administrators can access the approval queue.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Registration Approval Queue</h1>
          <p className="text-slate-400">Review and approve pending land registrations</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 glow-emerald"></div>
          </div>
        ) : parcels.length === 0 ? (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
            <ClipboardDocumentCheckIcon className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h3 className="text-lg font-semibold text-white mb-2">No Pending Approvals</h3>
            <p className="text-slate-400">All registrations have been reviewed</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {parcels.map(parcel => (
              <div key={parcel.id} className="bg-slate-800 rounded-xl border border-slate-700 p-6 transition-all duration-300 hover:shadow-lg hover:border-slate-600 hover:scale-[1.01]">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-white">Survey No: {parcel.surveyNumber}</h3>
                      <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                        {parcel.registrationStatus.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-slate-400 text-sm">
                      Submitted {new Date(parcel.submittedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedParcel(parcel)}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 text-sm"
                    >
                      Review
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-slate-400 text-xs mb-1">Area</div>
                    <div className="text-white font-medium">{(Number(parcel.areaSqM) * 10.764).toFixed(0)} sq.ft</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs mb-1">Village</div>
                    <div className="text-white font-medium">{parcel.village}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs mb-1">District</div>
                    <div className="text-white font-medium">{parcel.district}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs mb-1">State</div>
                    <div className="text-white font-medium">{parcel.state}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <UserIcon className="w-4 h-4" />
                    <span>{parcel.owner.name || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className={`px-2 py-1 rounded text-xs ${
                      parcel.owner.kycStatus === 'VERIFIED' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      KYC: {parcel.owner.kycStatus}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Review Modal */}
        {selectedParcel && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-700">
                <h2 className="text-xl font-bold text-white">Review Registration</h2>
              </div>

              <div className="p-6 space-y-6">
                {/* Land Details */}
                <div>
                  <h3 className="text-white font-semibold mb-3 flex items-center">
                    <MapPinIcon className="w-5 h-5 mr-2 text-emerald-400" />
                    Land Details
                  </h3>
                  <div className="bg-slate-700/50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Survey Number</span>
                      <span className="text-white font-medium">{selectedParcel.surveyNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Area</span>
                      <span className="text-white font-medium">{(Number(selectedParcel.areaSqM) * 10.764).toFixed(0)} sq.ft</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Location</span>
                      <span className="text-white font-medium">{selectedParcel.village}, {selectedParcel.district}, {selectedParcel.state}</span>
                    </div>
                  </div>
                </div>

                {/* Owner Details */}
                <div>
                  <h3 className="text-white font-semibold mb-3 flex items-center">
                    <UserIcon className="w-5 h-5 mr-2 text-emerald-400" />
                    Owner Details
                  </h3>
                  <div className="bg-slate-700/50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Name</span>
                      <span className="text-white font-medium">{selectedParcel.owner.name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Email</span>
                      <span className="text-white font-medium font-mono text-sm">{selectedParcel.owner.email || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Wallet</span>
                      <span className="text-white font-medium font-mono text-sm">
                        {selectedParcel.owner.walletAddress.slice(0, 6)}...{selectedParcel.owner.walletAddress.slice(-4)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">KYC Status</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        selectedParcel.owner.kycStatus === 'VERIFIED' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {selectedParcel.owner.kycStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rejection Reason (only show if rejecting) */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Rejection Reason (if rejecting)
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    placeholder="Provide reason for rejection..."
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-slate-700 flex gap-4">
                <button
                  onClick={() => {
                    setSelectedParcel(null);
                    setRejectionReason('');
                  }}
                  className="flex-1 px-6 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all duration-200 hover:scale-105"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReject(selectedParcel.parcelId)}
                  disabled={actionLoading || !rejectionReason.trim()}
                  className="flex-1 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-red-500/50 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center"
                >
                  <XCircleIcon className="w-5 h-5 mr-2" />
                  {actionLoading ? 'Rejecting...' : 'Reject'}
                </button>
                <button
                  onClick={() => handleApprove(selectedParcel.parcelId)}
                  disabled={actionLoading}
                  className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-green-500/50 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center"
                >
                  <CheckCircleIcon className="w-5 h-5 mr-2" />
                  {actionLoading ? 'Approving...' : 'Approve & Register'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
