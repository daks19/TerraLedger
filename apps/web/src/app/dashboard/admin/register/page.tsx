'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/components/Providers';
import {
  DocumentPlusIcon,
  MapPinIcon,
  UserIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

export default function RegisterLandPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    surveyNumber: '',
    areaSqM: '',
    village: '',
    district: '',
    state: '',
    ownerWallet: '',
    ownerName: '',
    ownerEmail: '',
    boundaryGeoJSON: '',
    documentsHash: '',
    latitude: '',
    longitude: '',
  });

  const isAdmin = user?.roles?.includes('ADMIN') || user?.roles?.includes('GOVERNMENT_OFFICIAL');

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
            <ExclamationTriangleIcon className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
            <p className="text-slate-400">Only administrators can register new land parcels.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = sessionStorage.getItem('accessToken');
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/land/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          surveyNumber: formData.surveyNumber,
          areaSqM: parseFloat((parseFloat(formData.areaSqM) / 10.764).toFixed(2)),
          village: formData.village,
          district: formData.district,
          state: formData.state,
          ownerWallet: formData.ownerWallet || '0x0000000000000000000000000000000000000000',
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
          boundaryGeoJSON: formData.boundaryGeoJSON || JSON.stringify({
            type: 'Polygon',
            coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
          }),
          documentsHash: formData.documentsHash || '',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to register land');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard/parcels');
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  if (success) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-8 text-center">
            <CheckCircleIcon className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-xl font-semibold text-white mb-2">Land Registered Successfully!</h2>
            <p className="text-slate-400">Redirecting to properties list...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Register New Land Parcel</h1>
          <p className="text-slate-400">Enter the details of the land parcel to register it in the system.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Land Details */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center">
              <MapPinIcon className="w-5 h-5 mr-2 text-emerald-400" />
              Land Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Survey Number *
                </label>
                <input
                  type="text"
                  name="surveyNumber"
                  value={formData.surveyNumber}
                  onChange={handleChange}
                  required
                  placeholder="e.g., SRV/2024/001"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Area (sq. ft) *
                </label>
                <input
                  type="number"
                  name="areaSqM"
                  value={formData.areaSqM}
                  onChange={handleChange}
                  required
                  min="1"
                  placeholder="e.g., 2500"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Village/Town *
                </label>
                <input
                  type="text"
                  name="village"
                  value={formData.village}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Andheri East"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  District *
                </label>
                <input
                  type="text"
                  name="district"
                  value={formData.district}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Mumbai Suburban"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  State *
                </label>
                <select
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                >
                  <option value="">Select State</option>
                  <option value="Maharashtra">Maharashtra</option>
                  <option value="Karnataka">Karnataka</option>
                  <option value="Delhi">Delhi</option>
                  <option value="Tamil Nadu">Tamil Nadu</option>
                  <option value="Gujarat">Gujarat</option>
                  <option value="Rajasthan">Rajasthan</option>
                  <option value="Uttar Pradesh">Uttar Pradesh</option>
                  <option value="West Bengal">West Bengal</option>
                  <option value="Telangana">Telangana</option>
                  <option value="Kerala">Kerala</option>
                </select>
              </div>
            </div>

            <div className="mt-6 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
              <h3 className="text-sm font-medium text-emerald-400 mb-3 flex items-center">
                <MapPinIcon className="w-4 h-4 mr-2" />
                GPS Coordinates <span className="text-red-400">*</span>
              </h3>
              <p className="text-xs text-slate-400 mb-3">Enter GPS coordinates to mark the property location on the map</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Latitude <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    name="latitude"
                    value={formData.latitude}
                    onChange={handleChange}
                    step="any"
                    placeholder="e.g., 19.1136"
                    required
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                  />
                  <p className="text-xs text-slate-400 mt-1">Range: -90 to 90</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Longitude <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    name="longitude"
                    value={formData.longitude}
                    onChange={handleChange}
                    step="any"
                    placeholder="e.g., 72.8697"
                    required
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                  />
                  <p className="text-xs text-slate-400 mt-1">Range: -180 to 180</p>
                </div>
              </div>
            </div>
          </div>

          {/* Owner Details */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center">
              <UserIcon className="w-5 h-5 mr-2 text-emerald-400" />
              Owner Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Owner Wallet Address
                </label>
                <input
                  type="text"
                  name="ownerWallet"
                  value={formData.ownerWallet}
                  onChange={handleChange}
                  placeholder="0x..."
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300 font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">Leave empty to assign later</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Owner Name
                </label>
                <input
                  type="text"
                  name="ownerName"
                  value={formData.ownerName}
                  onChange={handleChange}
                  placeholder="Full name"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Owner Email
                </label>
                <input
                  type="email"
                  name="ownerEmail"
                  value={formData.ownerEmail}
                  onChange={handleChange}
                  placeholder="owner@example.com"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                />
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center">
              <DocumentPlusIcon className="w-5 h-5 mr-2 text-emerald-400" />
              Documents & Boundaries
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Boundary GeoJSON
                </label>
                <textarea
                  name="boundaryGeoJSON"
                  value={formData.boundaryGeoJSON}
                  onChange={handleChange}
                  rows={4}
                  placeholder='{"type": "Polygon", "coordinates": [[[lon, lat], ...]]}'
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300 font-mono text-sm"
                />
                <p className="text-xs text-slate-400 mt-1">Optional: Paste GeoJSON polygon data</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Documents IPFS Hash
                </label>
                <input
                  type="text"
                  name="documentsHash"
                  value={formData.documentsHash}
                  onChange={handleChange}
                  placeholder="Qm..."
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300 font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">Optional: IPFS hash of uploaded documents</p>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center font-bold"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                  Registering...
                </>
              ) : (
                <>
                  <DocumentPlusIcon className="w-5 h-5 mr-2" />
                  Register Land
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
