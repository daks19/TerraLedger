'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { EyeIcon, EyeSlashIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  aadhaar: z.string().length(12, 'Aadhaar number must be 12 digits').regex(/^\d+$/, 'Aadhaar must contain only digits'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/email/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone,
          aadhaarNumber: data.aadhaar,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Registration failed');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen bg-slate-900">
        <nav className="bg-slate-800 border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Link href="/" className="flex items-center space-x-3 transition-transform duration-200">
              <div className="w-14 h-14 rounded-lg flex items-center justify-center overflow-hidden">
                <img src="/assests_own/logo.webp" alt="TerraLedger" className="w-full h-full object-contain" />
              </div>
              <div>
                <span className="text-2xl font-bold text-white">TerraLedger</span>
                <p className="text-xs text-slate-400">Land Records Portal</p>
              </div>
            </Link>
          </div>
        </nav>

        <div className="flex items-center justify-center py-16 px-4">
          <div className="w-full max-w-md text-center">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
              <CheckCircleIcon className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-white mb-2">Registration Submitted</h1>
              <p className="text-slate-300 mb-6">
                Your registration request has been submitted successfully. You will receive a 
                confirmation email once your account is verified by the authorities.
              </p>
              <Link
                href="/auth/login"
                className="inline-block py-3 px-6 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-600 transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/50"
              >
                Go to Login
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900">
      {/* Navigation */}
      <nav className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link href="/" className="flex items-center space-x-3 transition-transform duration-200">
            <div className="w-14 h-14 rounded-lg flex items-center justify-center overflow-hidden">
              <img src="/assests_own/logo.webp" alt="TerraLedger" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-2xl font-bold text-white">TerraLedger</span>
              <p className="text-xs text-slate-400">Land Records Portal</p>
            </div>
          </Link>
        </div>
      </nav>

      {/* Register Form */}
      <div className="flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-white mb-2">Register for Access</h1>
              <p className="text-slate-300">
                Create an account to access your land records online
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
                  Full Name (as per Aadhaar)
                </label>
                <input
                  {...register('name')}
                  type="text"
                  id="name"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Enter your full name"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                  Email Address
                </label>
                <input
                  {...register('email')}
                  type="email"
                  id="email"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Enter your email address"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-2">
                  Mobile Number
                </label>
                <input
                  {...register('phone')}
                  type="tel"
                  id="phone"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Enter your 10-digit mobile number"
                />
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
                )}
              </div>

              {/* Aadhaar */}
              <div>
                <label htmlFor="aadhaar" className="block text-sm font-medium text-slate-300 mb-2">
                  Aadhaar Number
                </label>
                <input
                  {...register('aadhaar')}
                  type="text"
                  id="aadhaar"
                  maxLength={12}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Enter your 12-digit Aadhaar number"
                />
                {errors.aadhaar && (
                  <p className="mt-1 text-sm text-red-600">{errors.aadhaar.message}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                  Create Password
                </label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent pr-12"
                    placeholder="Minimum 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="w-5 h-5" />
                    ) : (
                      <EyeIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-2">
                  Confirm Password
                </label>
                <input
                  {...register('confirmPassword')}
                  type="password"
                  id="confirmPassword"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Re-enter your password"
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-600 transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Submitting...' : 'Register'}
              </button>
            </form>

            {/* Login Link */}
            <div className="mt-6 pt-6 border-t border-slate-700 text-center">
              <p className="text-sm text-slate-400">
                Already have an account?{' '}
                <Link href="/auth/login" className="text-emerald-400 hover:text-emerald-300 transition-colors duration-200 hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </div>

          {/* Notice */}
          <div className="mt-6 bg-slate-700/50 border border-slate-600 rounded-lg p-4">
            <p className="text-sm text-slate-300">
              <strong>Verification Required:</strong> After registration, your account will be 
              reviewed and verified against official government records. You will receive an 
              email notification once your account is activated (typically within 2-3 business days).
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}