'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/components/Providers';
import {
  UserGroupIcon,
  PlusIcon,
  DocumentTextIcon,
  CalendarIcon,
  UserIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

interface Heir {
  id: string;
  walletAddress: string;
  percentage: number;
  releaseAge: number;
  birthDate: string;
  hasClaimed: boolean;
  user?: {
    name: string;
    email: string;
  };
}

interface Milestone {
  id: string;
  age: number;
  percentage: number;
}

interface InheritancePlan {
  id: string;
  planId: string;
  parcelIds: string[];
  status: string;
  useAgeMilestones: boolean;
  willHash?: string;
  deathCertHash?: string;
  createdAt: string;
  triggeredAt?: string;
  completedAt?: string;
  heirs: Heir[];
  milestones: Milestone[];
}

export default function InheritancePage() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<InheritancePlan | null>(null);
  const [eligibleClaims, setEligibleClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddHeirModal, setShowAddHeirModal] = useState(false);
  const [userParcels, setUserParcels] = useState<any[]>([]);

  useEffect(() => {
    fetchInheritanceData();
  }, []);

  const fetchInheritanceData = async () => {
    try {
      const token = sessionStorage.getItem('accessToken');
      
      // Fetch user's inheritance plan
      const planRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/inheritance/my-plan`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (planRes.ok) {
        const planData = await planRes.json();
        setPlan(planData);
      }

      // Fetch claimable inheritances
      const claimRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/inheritance/claim`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (claimRes.ok) {
        const claimData = await claimRes.json();
        setEligibleClaims(claimData.eligiblePlans || []);
      }

      // Fetch user's parcels for creating new plan
      const parcelsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/land/my-parcels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (parcelsRes.ok) {
        const parcelsData = await parcelsRes.json();
        setUserParcels(parcelsData);
      }
    } catch (error) {
      console.error('Failed to fetch inheritance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-500/20 text-green-400';
      case 'TRIGGERED': return 'bg-yellow-500/20 text-yellow-400';
      case 'EXECUTING': return 'bg-blue-500/20 text-blue-400';
      case 'COMPLETED': return 'bg-purple-500/20 text-purple-400';
      case 'CANCELLED': return 'bg-red-500/20 text-red-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Inheritance Management</h1>
            <p className="text-slate-400">Create inheritance plans and manage your beneficiaries</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 glow-emerald"></div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* My Inheritance Plan */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                <DocumentTextIcon className="w-5 h-5 mr-2 text-emerald-400" />
                My Inheritance Plan
              </h2>

              {plan ? (
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                  {/* Plan Header */}
                  <div className="p-6 border-b border-slate-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-white font-semibold">Plan #{plan.planId}</span>
                          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(plan.status)}`}>
                            {plan.status}
                          </span>
                        </div>
                        <div className="text-slate-400 text-sm">
                          Created: {new Date(plan.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      {plan.status === 'ACTIVE' && (
                        <button
                          onClick={() => setShowAddHeirModal(true)}
                          className="inline-flex items-center px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all duration-300 hover:scale-[1.02] glow-emerald font-bold"
                        >
                          <PlusIcon className="w-4 h-4 mr-2" />
                          Add Heir
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Properties in Plan */}
                  <div className="p-6 border-b border-slate-700">
                    <h3 className="text-sm font-medium text-slate-400 mb-3">Properties Included</h3>
                    <div className="flex flex-wrap gap-2">
                      {plan.parcelIds.map((parcelId) => (
                        <span key={parcelId} className="px-3 py-1 bg-slate-700 rounded-lg text-white text-sm font-mono">
                          {parcelId}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Heirs */}
                  <div className="p-6">
                    <h3 className="text-sm font-medium text-slate-400 mb-4">Beneficiaries ({plan.heirs.length})</h3>
                    {plan.heirs.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <UserGroupIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No heirs added yet</p>
                        <button
                          onClick={() => setShowAddHeirModal(true)}
                          className="mt-3 text-emerald-400 hover:underline transition-colors duration-300"
                        >
                          Add your first heir
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {plan.heirs.map((heir) => (
                          <div key={heir.id} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center">
                                <UserIcon className="w-5 h-5 text-slate-300" />
                              </div>
                              <div>
                                <div className="text-white font-medium">
                                  {heir.user?.name || 'Unknown'}
                                </div>
                                <div className="text-slate-400 text-sm font-mono">
                                  {heir.walletAddress.slice(0, 10)}...{heir.walletAddress.slice(-8)}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-bold text-emerald-400">{heir.percentage}%</div>
                              {heir.releaseAge > 0 && (
                                <div className="text-slate-400 text-xs">
                                  Release at age {heir.releaseAge}
                                </div>
                              )}
                              {heir.hasClaimed && (
                                <span className="inline-flex items-center text-green-400 text-xs">
                                  <CheckCircleIcon className="w-3 h-3 mr-1" />
                                  Claimed
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Milestones */}
                  {plan.useAgeMilestones && plan.milestones.length > 0 && (
                    <div className="p-6 border-t border-slate-700">
                      <h3 className="text-sm font-medium text-slate-400 mb-4">Age-Based Release Schedule</h3>
                      <div className="flex items-center gap-4">
                        {plan.milestones.sort((a, b) => a.age - b.age).map((milestone, idx) => (
                          <div key={milestone.id} className="flex items-center">
                            <div className="text-center">
                              <div className="text-white font-bold">{milestone.percentage}%</div>
                              <div className="text-slate-400 text-xs">at age {milestone.age}</div>
                            </div>
                            {idx < plan.milestones.length - 1 && (
                              <div className="w-8 h-0.5 bg-slate-600 mx-2"></div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
                  <UserGroupIcon className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                  <h3 className="text-xl font-semibold text-white mb-2">No Inheritance Plan</h3>
                  <p className="text-slate-400 mb-6">
                    Create an inheritance plan to ensure your properties are transferred to your beneficiaries.
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all duration-300 hover:scale-[1.02] glow-emerald font-bold"
                  >
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Create Inheritance Plan
                  </button>
                </div>
              )}
            </section>

            {/* Claimable Inheritances */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                <ClockIcon className="w-5 h-5 mr-2 text-orange-400" />
                Inheritances to Claim
              </h2>

              {eligibleClaims.length === 0 ? (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
                  <CheckCircleIcon className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                  <p className="text-slate-400">No pending inheritances to claim</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {eligibleClaims.map((claim, idx) => (
                    <div key={idx} className="bg-slate-800 rounded-xl border border-orange-500/30 p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-white font-semibold mb-1">
                            Inheritance from {claim.owner?.name || 'Unknown'}
                          </div>
                          <div className="text-slate-400 text-sm">
                            Properties: {claim.parcelIds.join(', ')}
                          </div>
                          <div className="text-slate-400 text-sm">
                            Your share: {claim.percentage}% (Claimable: {claim.claimablePercentage}%)
                          </div>
                        </div>
                        <button
                          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-orange-500/50"
                        >
                          Claim Now
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Create Plan Modal */}
        {showCreateModal && (
          <CreatePlanModal
            parcels={userParcels}
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              fetchInheritanceData();
            }}
          />
        )}

        {/* Add Heir Modal */}
        {showAddHeirModal && plan && (
          <AddHeirModal
            planId={plan.id}
            onClose={() => setShowAddHeirModal(false)}
            onSuccess={() => {
              setShowAddHeirModal(false);
              fetchInheritanceData();
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

// Create Plan Modal Component
function CreatePlanModal({ parcels, onClose, onSuccess }: {
  parcels: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedParcels, setSelectedParcels] = useState<string[]>([]);
  const [useAgeMilestones, setUseAgeMilestones] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedParcels.length === 0) {
      setError('Please select at least one property');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = sessionStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/inheritance/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          parcelIds: selectedParcels,
          useAgeMilestones,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create plan');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">Create Inheritance Plan</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Select Properties to Include
            </label>
            {parcels.length === 0 ? (
              <p className="text-slate-400 text-sm">You don't own any properties yet.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {parcels.map((parcel) => (
                  <label key={parcel.id} className="flex items-center p-3 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedParcels.includes(parcel.parcelId)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedParcels([...selectedParcels, parcel.parcelId]);
                        } else {
                          setSelectedParcels(selectedParcels.filter(id => id !== parcel.parcelId));
                        }
                      }}
                      className="mr-3"
                    />
                    <div>
                      <div className="text-white font-medium">{parcel.parcelId}</div>
                      <div className="text-slate-400 text-sm">{parcel.village}, {parcel.district}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useAgeMilestones}
                onChange={(e) => setUseAgeMilestones(e.target.checked)}
                className="mr-3"
              />
              <div>
                <span className="text-white">Enable age-based release</span>
                <p className="text-slate-400 text-sm">Release inheritance in phases based on heir's age</p>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || parcels.length === 0}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:hover:scale-100 transition-all duration-300 hover:scale-[1.02] glow-emerald font-bold"
            >
              {loading ? 'Creating...' : 'Create Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add Heir Modal Component
function AddHeirModal({ planId, onClose, onSuccess }: {
  planId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    walletAddress: '',
    percentage: '',
    releaseAge: '0',
    birthDate: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = sessionStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/inheritance/${planId}/heirs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          walletAddress: formData.walletAddress,
          percentage: parseInt(formData.percentage),
          releaseAge: parseInt(formData.releaseAge) || 0,
          birthDate: formData.birthDate || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add heir');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">Add Heir</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Wallet Address *
            </label>
            <input
              type="text"
              value={formData.walletAddress}
              onChange={(e) => setFormData({ ...formData, walletAddress: e.target.value })}
              required
              placeholder="0x..."
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Inheritance Percentage *
            </label>
            <input
              type="number"
              value={formData.percentage}
              onChange={(e) => setFormData({ ...formData, percentage: e.target.value })}
              required
              min="1"
              max="100"
              placeholder="e.g., 50"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Release Age (optional)
            </label>
            <input
              type="number"
              value={formData.releaseAge}
              onChange={(e) => setFormData({ ...formData, releaseAge: e.target.value })}
              min="0"
              placeholder="0 for immediate release"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white"
            />
            <p className="text-xs text-slate-400 mt-1">Set to 0 for immediate release, or enter age for delayed release</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Birth Date (optional)
            </label>
            <input
              type="date"
              value={formData.birthDate}
              onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:hover:scale-100 transition-all duration-300 hover:scale-[1.02] glow-emerald font-bold"
            >
              {loading ? 'Adding...' : 'Add Heir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}