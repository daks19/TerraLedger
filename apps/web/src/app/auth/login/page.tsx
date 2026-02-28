'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/components/Providers';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { login } = useAuth();

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/email/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Login failed');
      }

      login(result.accessToken, result.user);
      
      // Redirect to dashboard after login
      const params = new URLSearchParams(window.location.search);
      const redirectParam = params.get('redirect');
      const redirectTo = redirectParam?.startsWith('/') && !redirectParam.startsWith('//') ? redirectParam : '/dashboard';
      router.push(redirectTo);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0f1729]">
      {/* Navigation */}
      <nav className="bg-[#0f1729] border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-md flex items-center justify-center overflow-hidden">
              <img src="/assests_own/logo.webp" alt="TerraLedger" className="w-full h-full object-contain" />
            </div>
            <span className="text-lg font-semibold text-white">TerraLedger</span>
          </Link>
        </div>
      </nav>

      {/* Login Form */}
      <div className="flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-sm">
          <div className="bg-slate-800/60 rounded-lg border border-slate-700/40 p-6">
            <div className="mb-5">
              <h1 className="text-lg font-semibold text-white mb-1">Sign in</h1>
              <p className="text-sm text-slate-400">
                Access your land records with your registered credentials
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Email Address
                </label>
                <input
                  {...register('email')}
                  type="email"
                  id="email"
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors"
                  placeholder="you@example.com"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 pr-10 transition-colors"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="w-4 h-4" />
                    ) : (
                      <EyeIcon className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Register link */}
            <div className="mt-5 pt-4 border-t border-slate-700/50 text-center">
              <p className="text-sm text-slate-400">
                Don't have an account?{' '}
                <Link href="/auth/register" className="text-emerald-400 hover:text-emerald-300 hover:underline transition-colors">
                  Register for access
                </Link>
              </p>
            </div>
          </div>

          {/* Demo Credentials */}
          <div className="mt-3 bg-slate-800/40 border border-slate-700/30 rounded-lg p-3">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">Demo Credentials</p>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setValue('email', 'owner@example.com');
                  setValue('password', 'user1234');
                }}
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/40 rounded border border-slate-700/40 hover:border-slate-600 transition-colors text-left"
              >
                <div>
                  <div className="text-sm text-white">Land Owner</div>
                  <div className="text-[11px] text-slate-500 font-mono">owner@example.com / user1234</div>
                </div>
                <span className="text-[11px] text-slate-600">Click to fill</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setValue('email', 'terraadmin@terraledger.com');
                  setValue('password', 'password123');
                }}
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/40 rounded border border-slate-700/40 hover:border-slate-600 transition-colors text-left"
              >
                <div>
                  <div className="text-sm text-white">Admin</div>
                  <div className="text-[11px] text-slate-500 font-mono">terraadmin@terraledger.com / password123</div>
                </div>
                <span className="text-[11px] text-slate-600">Click to fill</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
