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
    <main className="min-h-screen bg-slate-900 relative">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl glow-pulse float"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl glow-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pulse" style={{animationDelay: '2s'}}></div>
      </div>

      {/* Navigation */}
      <nav className="relative bg-slate-900/50 backdrop-blur-lg border-b border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-14 h-14 rounded-lg flex items-center justify-center overflow-hidden">
                <img src="/assests_own/logo.webp" alt="TerraLedger" className="w-full h-full object-contain" />
              </div>
              <div>
                <span className="text-2xl font-bold text-white">TerraLedger</span>
                <p className="text-xs text-slate-400">Land Records Portal</p>
              </div>
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
                    className="px-5 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium transition-all duration-300 hover:scale-105 glow-emerald border border-emerald-400/30"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      router.push('/');
                    }}
                    className="text-sm text-red-400 hover:text-red-300 font-medium transition-all duration-200 hover:scale-105"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <Link 
                  href="/auth/login" 
                  className="px-5 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium transition-all duration-300 hover:scale-105 glow-emerald border border-emerald-400/30"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 animate-fade-in">
            Blockchain-Powered
            <span className="block mt-2 text-emerald-400 neon-text">
              Land Registry
            </span>
          </h1>
          <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto animate-fade-in delay-200">
            Secure, transparent, and efficient land ownership management powered by blockchain technology
          </p>
          <div className="flex items-center justify-center gap-4 animate-fade-in delay-300">
            <Link 
              href="/auth/register" 
              className="px-8 py-3.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-semibold transition-all duration-300 hover:scale-105 glow-emerald border border-emerald-400/30"
            >
              Get Started
            </Link>
            <Link 
              href="#features" 
              className="px-8 py-3.5 bg-slate-800/50 backdrop-blur-sm text-white rounded-lg hover:bg-slate-700/50 font-semibold transition-all duration-300 hover:scale-105 border border-slate-600/50"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-12 text-center">
            What You Can Access
          </h2>
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
      <section className="relative py-16 px-4 bg-slate-900/30 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-2xl font-bold text-emerald-400 mb-6 neon-text">How to Get Access</h3>
              <ul className="space-y-4 text-slate-300">
                <li className="flex items-start space-x-4 group hover:translate-x-2 transition-all duration-300">
                  <span className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 glow-emerald group-hover:scale-110 transition-transform duration-300">1</span>
                  <span className="pt-1">Register online with your Aadhaar and land ownership details</span>
                </li>
                <li className="flex items-start space-x-4 group hover:translate-x-2 transition-all duration-300">
                  <span className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 glow-emerald group-hover:scale-110 transition-transform duration-300">2</span>
                  <span className="pt-1">Upload required documents for online verification</span>
                </li>
                <li className="flex items-start space-x-4 group hover:translate-x-2 transition-all duration-300">
                  <span className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 glow-emerald group-hover:scale-110 transition-transform duration-300">3</span>
                  <span className="pt-1">Receive approval notification after server verification</span>
                </li>
                <li className="flex items-start space-x-4 group hover:translate-x-2 transition-all duration-300">
                  <span className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 glow-emerald group-hover:scale-110 transition-transform duration-300">4</span>
                  <span className="pt-1">Sign in to view your verified land records</span>
                </li>
              </ul>
            </div>
            <div className="space-y-6 animate-fade-in delay-200">
              <h3 className="text-2xl font-bold text-cyan-400 mb-6 neon-text-cyan">Notice</h3>
              <div className="bg-slate-800/80 backdrop-blur-sm border border-emerald-500/30 rounded-xl p-6 hover:border-emerald-500/50 transition-all duration-300 glow-emerald scale-in">
                <p className="text-slate-300 text-sm leading-relaxed">
                  <strong className="text-emerald-400">🔒 Data Security:</strong> Your records are secured using blockchain 
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
    <div className="bg-slate-800/80 rounded-xl shadow-xl p-6 border border-slate-700/50 transition-all duration-300 hover:scale-105 hover:border-emerald-500/50 group cursor-pointer hover-lift">
      <div className="w-14 h-14 rounded-lg bg-emerald-500 flex items-center justify-center text-white mb-4 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 glow-emerald">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-emerald-400 transition-colors">{title}</h3>
      <p className="text-slate-300 text-sm">{description}</p>
    </div>
  );
}

/* 

*/