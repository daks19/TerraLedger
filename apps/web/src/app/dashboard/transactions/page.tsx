'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/components/Providers';
import {
  ArrowsRightLeftIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

interface Transaction {
  id: string;
  type: string;
  status: string;
  amount?: number;
  parcelId: string;
  createdAt: string;
  completedAt?: string;
  seller?: { name: string; walletAddress: string };
  buyer?: { name: string; walletAddress: string };
  blockchainTxHash?: string;
}

export default function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const token = sessionStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/transactions/my-transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircleIcon className="w-5 h-5 text-green-400" />;
      case 'PENDING': return <ClockIcon className="w-5 h-5 text-yellow-400" />;
      case 'FAILED': return <XCircleIcon className="w-5 h-5 text-red-400" />;
      default: return <ClockIcon className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-500/20 text-green-400';
      case 'PENDING': return 'bg-yellow-500/20 text-yellow-400';
      case 'FAILED': return 'bg-red-500/20 text-red-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'all') return true;
    return tx.status === filter;
  });

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Transactions</h1>
            <p className="text-slate-400">View your property transfer history and pending transactions</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 hover:border-emerald-500/30 transition-colors">
            <div className="text-slate-400 text-sm mb-1">Total Transactions</div>
            <div className="text-2xl font-bold text-white">{transactions.length}</div>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 hover:border-emerald-500/30 transition-colors">
            <div className="text-slate-400 text-sm mb-1">Completed</div>
            <div className="text-2xl font-bold text-green-400">
              {transactions.filter(t => t.status === 'COMPLETED').length}
            </div>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 hover:border-emerald-500/30 transition-colors">
            <div className="text-slate-400 text-sm mb-1">Pending</div>
            <div className="text-2xl font-bold text-yellow-400">
              {transactions.filter(t => t.status === 'PENDING').length}
            </div>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 hover:border-emerald-500/30 transition-colors">
            <div className="text-slate-400 text-sm mb-1">Failed</div>
            <div className="text-2xl font-bold text-red-400">
              {transactions.filter(t => t.status === 'FAILED').length}
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-4 mb-6">
          <FunnelIcon className="w-5 h-5 text-slate-400" />
          <div className="flex gap-2">
            {['all', 'PENDING', 'COMPLETED', 'FAILED'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  filter === status
                    ? 'bg-emerald-500 text-white glow-emerald'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {status === 'all' ? 'All' : status}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 glow-emerald"></div>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
            <ArrowsRightLeftIcon className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h3 className="text-xl font-semibold text-white mb-2">No Transactions</h3>
            <p className="text-slate-400">
              {filter === 'all' 
                ? "You don't have any transactions yet."
                : `No ${filter.toLowerCase()} transactions found.`}
            </p>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-6 py-4 text-slate-400 font-medium">Transaction</th>
                    <th className="text-left px-6 py-4 text-slate-400 font-medium">Property</th>
                    <th className="text-left px-6 py-4 text-slate-400 font-medium">Parties</th>
                    <th className="text-left px-6 py-4 text-slate-400 font-medium">Status</th>
                    <th className="text-left px-6 py-4 text-slate-400 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-700/50 transition-all duration-200 hover:scale-[1.005]">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
                            {tx.type === 'SALE' ? (
                              <ArrowsRightLeftIcon className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <DocumentTextIcon className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="text-white font-medium">{tx.type}</div>
                            {tx.blockchainTxHash && (
                              <div className="text-slate-400 text-xs font-mono">
                                {tx.blockchainTxHash.slice(0, 10)}...
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/dashboard/parcels/${tx.parcelId}`} className="text-emerald-400 hover:underline font-mono transition-colors duration-200 hover:text-emerald-300">
                          {tx.parcelId}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          {tx.seller && (
                            <div className="flex items-center gap-1 text-red-400">
                              <ArrowUpIcon className="w-3 h-3" />
                              <span>{tx.seller.name || tx.seller.walletAddress.slice(0, 10)}</span>
                            </div>
                          )}
                          {tx.buyer && (
                            <div className="flex items-center gap-1 text-green-400">
                              <ArrowDownIcon className="w-3 h-3" />
                              <span>{tx.buyer.name || tx.buyer.walletAddress.slice(0, 10)}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getStatusColor(tx.status)}`}>
                          {getStatusIcon(tx.status)}
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">
                        {new Date(tx.createdAt).toLocaleDateString()}
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
