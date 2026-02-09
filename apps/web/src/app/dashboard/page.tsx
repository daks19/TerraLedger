'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/components/Providers';
import {
  DocumentTextIcon,
  MapIcon,
  ArrowsRightLeftIcon,
  UserGroupIcon,
  PlusIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  BellAlertIcon,
  UserIcon,
  DocumentCheckIcon,
  FlagIcon,
} from '@heroicons/react/24/outline';

interface DashboardStats {
  totalParcels: number;
  pendingTransactions: number;
  totalArea: number;
  inheritancePlans: number;
  pendingApprovals?: number;
}

interface SystemStatus {
  database: 'healthy' | 'warning' | 'error';
  blockchain: 'healthy' | 'warning' | 'error';
  ipfs: 'healthy' | 'warning' | 'error';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalParcels: 0,
    pendingTransactions: 0,
    totalArea: 0,
    inheritancePlans: 0,
    pendingApprovals: 0,
  });
  const [recentParcels, setRecentParcels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [systemStatus] = useState<SystemStatus>({
    database: 'healthy',
    blockchain: 'healthy',
    ipfs: 'healthy',
  });
  const [pendingKYC, setPendingKYC] = useState<any[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);

  const isAdmin = user?.roles?.includes('ADMIN') || user?.roles?.includes('GOVERNMENT_OFFICIAL');

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const token = sessionStorage.getItem('accessToken');
      const userRoles = user?.roles || [];
      const isAdminUser = userRoles.includes('ADMIN') || userRoles.includes('GOVERNMENT_OFFICIAL');
      
      // Fetch parcels - all for admin, own for regular users
      const endpoint = isAdminUser ? '/api/land/all' : '/api/land/my-parcels';
      const parcelsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (parcelsRes.ok) {
        const parcels = await parcelsRes.json();
        setRecentParcels(parcels.slice(0, 5));
        setStats(prev => ({
          ...prev,
          totalParcels: parcels.length,
          totalArea: parcels.reduce((sum: number, p: any) => sum + (Number(p.areaSqM) || 0), 0),
        }));
      }

      // Fetch pending approvals count for admin
      if (isAdmin) {
        const approvalsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/land/pending-approvals`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (approvalsRes.ok) {
          const approvals = await approvalsRes.json();
          setPendingKYC(approvals);
          setStats(prev => ({ ...prev, pendingApprovals: approvals.length }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { name: 'View Properties', href: '/dashboard/parcels', icon: DocumentTextIcon, color: 'bg-blue-500' },
    { name: 'Property Map', href: '/dashboard/map', icon: MapIcon, color: 'bg-green-500' },
    { name: 'Transactions', href: '/dashboard/transactions', icon: ArrowsRightLeftIcon, color: 'bg-purple-500' },
    { name: 'Inheritance', href: '/dashboard/inheritance', icon: UserGroupIcon, color: 'bg-orange-500' },
  ];

  const adminActions = [
    { name: 'Register Land', href: '/dashboard/admin/register', icon: PlusIcon, color: 'bg-emerald-500' },
    { name: 'Manage Parcels', href: '/dashboard/admin/parcels', icon: DocumentTextIcon, color: 'bg-cyan-500' },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* System Status Bar (Admin Only) */}
        {isAdmin && (
          <div className="mb-6 bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <ShieldCheckIcon className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-300 font-medium">System Status</span>
                </div>
                <div className="flex items-center gap-4">
                  <StatusIndicator label="Database" status={systemStatus.database} />
                  <StatusIndicator label="Blockchain" status={systemStatus.blockchain} />
                  <StatusIndicator label="IPFS" status={systemStatus.ipfs} />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Link 
                  href="/dashboard/admin/approvals"
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/20 transition-colors"
                >
                  <ClockIcon className="w-4 h-4 text-yellow-500" />
                  <span className="text-yellow-500 font-medium">{stats.pendingApprovals || 0} Pending Approvals</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Search Bar (Admin Only) */}
        {isAdmin && (
          <div className="mb-6">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search properties, transactions, users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
              />
            </div>
          </div>
        )}

        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">
            Welcome back, {user?.name || 'User'}!
          </h1>
          <p className="text-slate-400">
            Here's an overview of your land records and recent activity.
          </p>
        </div>

        {/* Admin Features - Only shown for admins */}
        {isAdmin ? (
          <>
            {/* Alerts & Notifications */}
            {alerts.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <BellAlertIcon className="w-5 h-5 text-red-400" />
                    Critical Alerts
                  </h2>
                </div>
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-xl border flex items-start gap-3 ${
                        alert.type === 'error' ? 'bg-red-500/10 border-red-500/30' :
                        alert.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                        'bg-blue-500/10 border-blue-500/30'
                      }`}
                    >
                      <ExclamationTriangleIcon className={`w-5 h-5 flex-shrink-0 ${
                        alert.type === 'error' ? 'text-red-400' :
                        alert.type === 'warning' ? 'text-yellow-400' :
                        'text-blue-400'
                      }`} />
                      <div className="flex-1">
                        <p className={`font-medium ${
                          alert.type === 'error' ? 'text-red-400' :
                          alert.type === 'warning' ? 'text-yellow-400' :
                          'text-blue-400'
                        }`}>
                          {alert.message}
                        </p>
                        <p className="text-slate-400 text-sm mt-1">{alert.time}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        alert.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                        alert.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {alert.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Pending Land Approval Queue */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <ClockIcon className="w-5 h-5 text-yellow-400" />
                    Pending Land Approvals
                  </h2>
                  <span className="text-sm text-slate-400">{pendingKYC.length} pending</span>
                </div>
                <div className="divide-y divide-slate-700 max-h-96 overflow-y-auto">
                  {pendingKYC.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <CheckCircleIcon className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                      No pending approvals
                    </div>
                  ) : (
                    pendingKYC.map((parcel: any) => (
                      <div key={parcel.id} className="p-4 hover:bg-slate-700/50 transition">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                              <DocumentTextIcon className="w-5 h-5 text-yellow-400" />
                            </div>
                            <div>
                              <div className="text-white font-medium font-mono">{parcel.parcelId}</div>
                              <div className="text-slate-400 text-sm">{parcel.village}, {parcel.district}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-white text-sm">{(Number(parcel.areaSqM) * 10.764).toFixed(0)} sq.ft</div>
                            <div className="text-slate-500 text-xs">{parcel.submittedBy?.name || parcel.owner?.name || 'Unknown'}</div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            disabled={approvingId === parcel.parcelId}
                            onClick={async () => {
                              setApprovingId(parcel.parcelId);
                              try {
                                const token = sessionStorage.getItem('accessToken');
                                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/land/approve/${parcel.parcelId}`, {
                                  method: 'POST',
                                  headers: { Authorization: `Bearer ${token}` },
                                });
                                if (res.ok) {
                                  setPendingKYC(prev => prev.filter(p => p.id !== parcel.id));
                                  setStats(prev => ({ ...prev, pendingApprovals: (prev.pendingApprovals || 1) - 1 }));
                                }
                              } catch (e) { console.error(e); }
                              setApprovingId(null);
                            }}
                            className="flex-1 px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition disabled:opacity-50"
                          >
                            {approvingId === parcel.parcelId ? 'Approving...' : 'Approve'}
                          </button>
                          <Link
                            href={`/dashboard/admin/approvals`}
                            className="flex-1 px-3 py-1.5 bg-slate-700 text-slate-300 text-sm rounded-lg hover:bg-slate-600 transition text-center"
                          >
                            Review
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Disputes */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <FlagIcon className="w-5 h-5 text-red-400" />
                    Active Disputes
                  </h2>
                  <span className="text-sm text-slate-400">{disputes.length} open</span>
                </div>
                <div className="divide-y divide-slate-700">
                  {disputes.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      No active disputes
                    </div>
                  ) : (
                    disputes.map((dispute) => (
                      <Link
                        key={dispute.id}
                        href={`/dashboard/parcels/${dispute.parcelId}`}
                        className="block p-4 hover:bg-slate-700/50 transition"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="text-white font-medium font-mono">{dispute.parcelId}</div>
                            <div className="text-slate-400 text-sm">{dispute.type}</div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded ${
                            dispute.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {dispute.priority}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-orange-400">{dispute.status}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400">Filed {dispute.filedAt}</span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Recent Activity Feed */}
            {recentActivity.length > 0 && (
              <div className="mb-8 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700">
                  <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
                </div>
                <div className="divide-y divide-slate-700 max-h-96 overflow-y-auto">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="px-6 py-4 hover:bg-slate-700/50 transition">
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 ${
                          activity.type === 'success' ? 'bg-green-400' :
                          activity.type === 'warning' ? 'bg-yellow-400' :
                          'bg-blue-400'
                        }`} />
                        <div className="flex-1">
                          <div className="text-white">
                            <span className="font-medium">{activity.user}</span>
                            {' '}
                            <span className="text-slate-400">{activity.action}</span>
                            {' '}
                            <span className="font-mono text-emerald-400">{activity.target}</span>
                          </div>
                          <div className="text-slate-500 text-sm mt-1">{activity.time}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Actions */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-4">
                <span className="inline-flex items-center">
                  <ShieldCheckIcon className="w-5 h-5 mr-2 text-yellow-500" />
                  Admin Actions
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {adminActions.map((action) => (
                  <Link
                    key={action.name}
                    href={action.href}
                    className="flex items-center gap-4 p-6 bg-slate-800 rounded-xl border border-slate-700 hover:border-emerald-500/60 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-500/20 group cursor-pointer"
                  >
                    <div className={`w-14 h-14 ${action.color} rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                      <action.icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-semibold text-lg">{action.name}</div>
                      <div className="text-slate-400 text-sm">
                        {action.name === 'Register Land' ? 'Add new property to the system' : 'View and manage all properties'}
                      </div>
                    </div>
                    <div className="text-slate-400 group-hover:text-emerald-400 transition-colors">
                      →
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Stats Grid - For regular users only */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard
                title="Total Properties"
                value={stats.totalParcels}
                icon={DocumentTextIcon}
                color="bg-blue-500"
              />
              <StatCard
                title="Total Area"
                value={`${(stats.totalArea * 10.764).toFixed(0).toLocaleString()} sq.ft`}
                icon={MapIcon}
                color="bg-green-500"
              />
              <StatCard
                title="Pending Transactions"
                value={stats.pendingTransactions}
                icon={ArrowsRightLeftIcon}
                color="bg-purple-500"
              />
              <StatCard
                title="Inheritance Plans"
                value={stats.inheritancePlans}
                icon={UserGroupIcon}
                color="bg-orange-500"
              />
            </div>

            {/* Quick Actions - For regular users */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {quickActions.map((action) => (
                  <Link
                    key={action.name}
                    href={action.href}
                    className="flex flex-col items-center p-6 bg-slate-800 rounded-xl border border-slate-700 hover:border-slate-600 transition-all duration-300 hover:scale-105 hover:shadow-lg group"
                  >
                    <div className={`w-12 h-12 ${action.color} rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                      <action.icon className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-white font-medium text-center">{action.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        {/* My Properties - Only for regular users */}
        {!isAdmin && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">My Properties</h2>
              <Link href="/dashboard/parcels" className="text-emerald-400 hover:text-emerald-300 text-sm transition-all duration-200 hover:scale-105 inline-block">
                View all →
              </Link>
            </div>
            
            {loading ? (
              <div className="p-8 text-center text-slate-400">Loading...</div>
            ) : recentParcels.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <DocumentTextIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No properties found</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {recentParcels.map((parcel) => (
                  <Link
                    key={parcel.id}
                    href={`/dashboard/parcels/${parcel.parcelId}`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-slate-700/50 transition-all duration-200 hover:scale-[1.01] hover:shadow-lg cursor-pointer"
                  >
                    <div>
                      <div className="text-white font-medium">{parcel.parcelId}</div>
                      <div className="text-slate-400 text-sm">
                        {parcel.village}, {parcel.district}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-300">{(Number(parcel.areaSqM) * 10.764).toFixed(0).toLocaleString()} sq.ft</div>
                      <div className={`text-xs px-2 py-1 rounded-full ${
                        parcel.status === 'VERIFIED' ? 'bg-green-500/20 text-green-400' :
                        parcel.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {parcel.status}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({ title, value, icon: Icon, color }: {
  title: string;
  value: string | number;
  icon: any;
  color: string;
}) {
  return (
    <div className="group bg-slate-800/80 rounded-xl border border-slate-700/50 p-6 hover:border-emerald-500/50 transition-all duration-500 hover:scale-105 cursor-default hover-lift glow-emerald">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-300`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <div className="text-3xl font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors duration-300">{value}</div>
      <div className="text-slate-400 text-sm font-medium uppercase tracking-wide">{title}</div>
    </div>
  );
}

function StatusIndicator({ label, status }: { label: string; status: 'healthy' | 'warning' | 'error' }) {
  const statusConfig = {
    healthy: { color: 'text-green-400', icon: CheckCircleIcon, bg: 'bg-green-500/10' },
    warning: { color: 'text-yellow-400', icon: ExclamationTriangleIcon, bg: 'bg-yellow-500/10' },
    error: { color: 'text-red-400', icon: ExclamationTriangleIcon, bg: 'bg-red-500/10' },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <div className={`p-1 rounded ${config.bg}`}>
        <Icon className={`w-4 h-4 ${config.color}`} />
      </div>
      <span className="text-slate-400 text-sm">{label}</span>
    </div>
  );
}
