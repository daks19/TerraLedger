'use client';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../Providers';
import { useWallet } from '@/contexts/WalletContext';
import {
  HomeIcon,
  MapIcon,
  DocumentTextIcon,
  ArrowsRightLeftIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  UserIcon,
  BellIcon,
  ChevronDownIcon,
  PlusCircleIcon,
  ClipboardDocumentListIcon,
  DocumentPlusIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';

interface DashboardLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'My Properties', href: '/dashboard/parcels', icon: DocumentTextIcon },
  { name: 'Register Land', href: '/dashboard/register-land', icon: DocumentPlusIcon },
  { name: 'Property Map', href: '/dashboard/map', icon: MapIcon },
  { name: 'Transactions', href: '/dashboard/transactions', icon: ArrowsRightLeftIcon },
  { name: 'Inheritance', href: '/dashboard/inheritance', icon: UserGroupIcon },
];

const adminNavigation = [
  { name: 'Admin Registration', href: '/dashboard/admin/register', icon: PlusCircleIcon },
  { name: 'Approval Queue', href: '/dashboard/admin/approvals', icon: ClipboardDocumentCheckIcon },
  { name: 'Manage Parcels', href: '/dashboard/admin/parcels', icon: ClipboardDocumentListIcon },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const { account, isConnected, isConnecting, connect } = useWallet();
  const pathname = usePathname();
  const router = useRouter();

  const isAdmin = user?.roles?.includes('ADMIN') || user?.roles?.includes('GOVERNMENT_OFFICIAL');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl glow-emerald" />
          <div className="relative animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-400"></div>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-900 relative">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-[34rem] h-[34rem] bg-emerald-500/10 rounded-full blur-3xl glow-pulse float" />
        <div className="absolute -bottom-28 -right-28 w-[40rem] h-[40rem] bg-cyan-500/10 rounded-full blur-3xl glow-pulse" style={{animationDelay: '1.5s'}} />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-slate-900/60 backdrop-blur-xl border-r border-slate-700/50 transform transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-700/50">
          <Link href="/dashboard" className="flex items-center space-x-3 transition-transform duration-200 hover:scale-105">
            <div className="w-14 h-14 rounded-lg flex items-center justify-center overflow-hidden">
              <img src="/assests_own/logo.webp" alt="TerraLedger" className="w-full h-full object-contain" />
            </div>
            <span className="text-2xl font-bold text-white">TerraLedger</span>
          </Link>
          <button
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {/* Regular user navigation - hide for admins */}
          {!isAdmin && navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 border ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 glow-emerald'
                    : 'text-slate-300/80 border-transparent hover:bg-slate-800/60 hover:text-white hover:scale-[1.02]'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}

          {/* Admin Section */}
          {isAdmin && (
            <>
              <div className="pb-2">
                <div className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Admin Panel
                </div>
              </div>
              {adminNavigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 border ${
                      isActive
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 glow-emerald'
                        : 'text-slate-300/80 border-transparent hover:bg-slate-800/60 hover:text-white hover:scale-[1.02]'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* User Info (Mobile) */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700 lg:hidden">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <div className="text-white font-medium">{user?.name || 'User'}</div>
              <div className="text-slate-400 text-sm">{user?.roles?.[0] || 'USER'}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 text-slate-400 hover:text-white transition-all duration-200 hover:scale-105"
          >
            <ArrowLeftOnRectangleIcon className="w-5 h-5" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Bar */}
        <header className="h-16 bg-slate-900/40 backdrop-blur-xl border-b border-slate-700/50 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
          {/* Mobile menu button */}
          <button
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="w-6 h-6" />
          </button>

          {/* Search */}
          <div className="hidden lg:block flex-1 max-w-md">
            <input
              type="search"
              placeholder="Search properties, transactions..."
              className="w-full px-4 py-2 rounded-lg bg-slate-900/60 backdrop-blur-sm border border-slate-700/50 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors duration-200"
            />
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* Wallet Connection */}
            {isConnected && account ? (
              <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-green-400 text-sm font-mono">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </span>
              </div>
            ) : (
              <button
                onClick={connect}
                disabled={isConnecting}
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all duration-300 hover:scale-105 glow-emerald disabled:opacity-50 disabled:hover:scale-100 border border-emerald-400/30"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}

            {/* Notifications */}
            <button className="relative p-2 text-slate-400 hover:text-white transition-all duration-200 hover:scale-110">
              <BellIcon className="w-6 h-6" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* User Menu */}
            <div className="relative hidden lg:block">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-slate-800/60 transition-all duration-200 hover:scale-105 border border-transparent hover:border-slate-700/60"
              >
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-slate-400" />
                </div>
                <span className="text-white font-medium">{user?.name || 'User'}</span>
                <ChevronDownIcon className="w-4 h-4 text-slate-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-900/80 backdrop-blur-xl rounded-xl shadow-2xl border border-slate-700/50 py-1 overflow-hidden">
                  <Link
                    href="/dashboard/settings"
                    className="block px-4 py-2.5 text-slate-200 hover:bg-slate-800/60 hover:text-white transition-colors duration-200"
                  >
                    Settings
                  </Link>
                  <hr className="my-1 border-slate-700" />
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-slate-200 hover:bg-slate-800/60 hover:text-white transition-colors duration-200"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="relative p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
