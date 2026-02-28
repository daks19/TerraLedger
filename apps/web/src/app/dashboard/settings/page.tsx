'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/components/Providers';
import { useWallet } from '@/contexts/WalletContext';
import {
  UserIcon,
  ShieldCheckIcon,
  BellIcon,
  KeyIcon,
  GlobeAltIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

export default function SettingsPage() {
  const { user } = useAuth();
  const { account, isConnected, isConnecting, connect, disconnect } = useWallet();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
  });

  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    transactionAlerts: true,
    marketingEmails: false,
  });

  const handleSaveProfile = async () => {
    setSaving(true);
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    setSuccess('Profile updated successfully!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const tabs = [
    { id: 'profile', name: 'Profile', icon: UserIcon },
    { id: 'security', name: 'Security', icon: ShieldCheckIcon },
    { id: 'notifications', name: 'Notifications', icon: BellIcon },
    { id: 'kyc', name: 'KYC Verification', icon: ShieldCheckIcon },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
          <p className="text-slate-400">Manage your account settings and preferences</p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 flex items-center">
            <CheckCircleIcon className="w-5 h-5 mr-2" />
            {success}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Tabs */}
          <div className="lg:w-64 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.name}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 max-w-2xl">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-white mb-6">Profile Information</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      placeholder="+91 XXXXX XXXXX"
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                    />
                  </div>
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all duration-300 disabled:opacity-50 font-bold"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                  <h2 className="text-lg font-semibold text-white mb-6">Change Password</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Current Password
                      </label>
                      <input
                        type="password"
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        New Password
                      </label>
                      <input
                        type="password"
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                      />
                    </div>
                    <button className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all duration-300 font-bold">
                      Update Password
                    </button>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                  <h2 className="text-lg font-semibold text-white mb-4">Wallet Connection</h2>
                  <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <KeyIcon className="w-5 h-5 text-emerald-400" />
                      <div>
                        <div className="text-white font-medium">MetaMask</div>
                        <div className="text-slate-400 text-sm font-mono">
                          {isConnected && account ? (
                            `${account.slice(0, 6)}...${account.slice(-4)}`
                          ) : (
                            'Not connected'
                          )}
                        </div>
                      </div>
                    </div>
                    {isConnected ? (
                      <button 
                        onClick={disconnect}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button 
                        onClick={connect}
                        disabled={isConnecting}
                        className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-all duration-300"
                      >
                        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                  <h2 className="text-lg font-semibold text-white mb-4">KYC Verification</h2>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ShieldCheckIcon className="w-6 h-6 text-green-400" />
                      <div>
                        <div className="text-white font-medium">Identity Verified</div>
                        <div className="text-slate-400 text-sm">Your KYC documents have been approved</div>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                      Verified
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-white mb-6">Notification Preferences</h2>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">Email Notifications</div>
                      <div className="text-slate-400 text-sm">Receive updates via email</div>
                    </div>
                    <button
                      onClick={() => setNotifications({ ...notifications, emailNotifications: !notifications.emailNotifications })}
                      className={`w-12 h-6 rounded-full transition-all duration-300 ${
                        notifications.emailNotifications ? 'bg-emerald-500' : 'bg-slate-600'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transform transition ${
                        notifications.emailNotifications ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">Transaction Alerts</div>
                      <div className="text-slate-400 text-sm">Get notified about property transactions</div>
                    </div>
                    <button
                      onClick={() => setNotifications({ ...notifications, transactionAlerts: !notifications.transactionAlerts })}
                      className={`w-12 h-6 rounded-full transition-all duration-300 ${
                        notifications.transactionAlerts ? 'bg-emerald-500' : 'bg-slate-600'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transform transition ${
                        notifications.transactionAlerts ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">Marketing Emails</div>
                      <div className="text-slate-400 text-sm">Receive news and updates</div>
                    </div>
                    <button
                      onClick={() => setNotifications({ ...notifications, marketingEmails: !notifications.marketingEmails })}
                      className={`w-12 h-6 rounded-full transition-all duration-300 ${
                        notifications.marketingEmails ? 'bg-emerald-500' : 'bg-slate-600'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transform transition ${
                        notifications.marketingEmails ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* KYC Tab */}
            {activeTab === 'kyc' && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-white mb-6">KYC Verification</h2>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <ShieldCheckIcon className="w-6 h-6 text-green-400" />
                      <div>
                        <div className="text-white font-medium">Identity Verified</div>
                        <div className="text-slate-400 text-sm">Your KYC documents have been approved</div>
                      </div>
                    </div>
                    <CheckCircleIcon className="w-6 h-6 text-green-400" />
                  </div>

                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <h3 className="text-white font-medium mb-3">Verification Details</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Status:</span>
                        <span className="text-green-400 font-medium">Verified</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Verification Date:</span>
                        <span className="text-white">Jan 15, 2026</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Document Type:</span>
                        <span className="text-white">Government ID</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-slate-400">
                    <p>Your identity has been verified and you have full access to all TerraLedger features including property registration, transfers, and blockchain transactions.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
