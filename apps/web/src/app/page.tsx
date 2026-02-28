'use client';

import Link from 'next/link';
import { 
  MagnifyingGlassIcon,
  MapIcon,
  DocumentTextIcon,
  BuildingOffice2Icon,
  PhoneIcon,
  EnvelopeIcon,
  DocumentDuplicateIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '@/components/Providers';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { isAuthenticated, user, logout } = useAuth();
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#0f1729] relative">

      {/* Navigation */}
      <nav className="bg-[#0f1729] border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
                <img src="/assests_own/logo.webp" alt="TerraLedger" className="w-full h-full object-contain" />
              </div>
              <span className="text-lg font-semibold text-white">TerraLedger</span>
            </div>
            <div className="hidden md:flex items-center space-x-6">
              <Link href="/" className="text-slate-300 hover:text-emerald-400 font-medium transition-colors duration-200">
                Home
              </Link>
              {isAuthenticated ? (
                <>
                  <span className="text-sm text-slate-300">
                    Welcome, <strong>{user?.name || 'User'}</strong>
                  </span>
                  <Link 
                    href="/dashboard" 
                    className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 font-medium transition-colors"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      router.push('/');
                    }}
                    className="text-sm text-red-400 hover:text-red-300 font-medium transition-colors"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <Link 
                  href="/auth/login" 
                  className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 font-medium transition-colors"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-10 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Blockchain-Powered
            <span className="block mt-2 text-emerald-400">
              Land Registry
            </span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl">
            Secure, transparent, and efficient land ownership management powered by blockchain technology
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative pt-6 pb-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              icon={<MagnifyingGlassIcon className="w-8 h-8" />}
              title="View Land Records"
              description="Access your registered land records, survey numbers, and property details"
            />
            <FeatureCard
              icon={<MapIcon className="w-8 h-8" />}
              title="Property Boundaries"
              description="View your property boundaries on interactive maps with GPS coordinates"
            />
            <FeatureCard
              icon={<DocumentTextIcon className="w-8 h-8" />}
              title="Ownership History"
              description="View the complete ownership history and transaction records"
            />
          </div>
        </div>
      </section>

      {/* Information Section */}
      <section className="relative py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10">
            <div className="space-y-5">
              <h3 className="text-xl font-semibold text-emerald-400 mb-4">How to Get Access</h3>
              <ul className="space-y-4 text-slate-300">
                <li className="flex items-start space-x-3">
                  <span className="w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0">1</span>
                  <span className="pt-0.5 text-sm">Register online with your Aadhaar and land ownership details</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0">2</span>
                  <span className="pt-0.5 text-sm">Upload required documents for online verification</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0">3</span>
                  <span className="pt-0.5 text-sm">Receive approval notification after server verification</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0">4</span>
                  <span className="pt-0.5 text-sm">Sign in to view your verified land records</span>
                </li>
              </ul>
            </div>
            <div className="space-y-5">
              <h3 className="text-xl font-semibold text-slate-300 mb-4">Notice</h3>
              <div className="bg-slate-800/60 border border-slate-700/40 rounded-lg p-5">
                <p className="text-slate-400 text-sm leading-relaxed">
                  <strong className="text-emerald-400">Data Security:</strong> Your records are secured using blockchain 
                  technology. All modifications require server-side verification and are 
                  immutably recorded on the blockchain.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-800 text-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mt-8 pt-8 border-t border-slate-700 text-center text-slate-400 text-sm">
            <p>© {new Date().getFullYear()} TerraLedger. All rights reserved.</p>
            <p className="mt-2 text-slate-500">
              Privacy Policy | Terms of Use | Accessibility
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) {
  return (
    <div className="bg-slate-800/60 rounded-lg p-5 border border-slate-700/40 hover:border-slate-600 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white mb-3">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-white mb-1.5">{title}</h3>
      <p className="text-slate-400 text-sm">{description}</p>
    </div>
  );
}

/* 

*/