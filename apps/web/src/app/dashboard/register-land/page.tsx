'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/components/Providers';
import {
  DocumentPlusIcon,
  MapPinIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  CloudArrowUpIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

type Step = 1 | 2 | 3;

interface UploadedDocument {
  id: string;
  name: string;
  type: string;
  ipfsHash: string;
  size: number;
}

export default function RegisterMyLandPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([]);

  const [formData, setFormData] = useState({
    surveyNumber: '',
    areaSqM: '',
    village: '',
    district: '',
    state: '',
    boundaryGeoJSON: '',
    latitude: '',
    longitude: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, documentType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);

      const token = sessionStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/upload/document`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload document');
      }

      // Map backend response to frontend interface
      const uploadedDoc: UploadedDocument = {
        id: data.id,
        name: data.fileName,
        type: data.documentType,
        ipfsHash: data.ipfsHash,
        size: data.fileSize,
      };

      setUploadedDocs(prev => [...prev, uploadedDoc]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const token = sessionStorage.getItem('accessToken');

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/land/self-register`, {
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
          boundaryGeoJSON: formData.boundaryGeoJSON || null,
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
          documentIds: uploadedDocs.map(d => d.id),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit registration');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <div className="max-w-2xl mx-auto bg-green-500/10 border border-green-500/30 rounded-xl p-8 text-center">
            <CheckCircleIcon className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-xl font-semibold text-white mb-2">Registration Submitted!</h2>
            <p className="text-slate-400 mb-6">
              Your land registration has been submitted for review. You'll be notified once an admin reviews your application.
            </p>
            <button
              onClick={() => router.push('/dashboard/parcels')}
              className="px-8 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all duration-300 hover:scale-105 glow-emerald font-bold border border-emerald-400/30"
            >
              View My Properties
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Register My Land</h1>
          <p className="text-slate-400">Submit your land registration for government approval</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 flex items-center justify-between">
          <StepIndicator step={1} currentStep={currentStep} label="Land Details" />
          <div className="flex-1 h-1 bg-slate-700 mx-2" />
          <StepIndicator step={2} currentStep={currentStep} label="Documents" />
          <div className="flex-1 h-1 bg-slate-700 mx-2" />
          <StepIndicator step={3} currentStep={currentStep} label="Review" />
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Step 1: Land Details */}
        {currentStep === 1 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center">
              <MapPinIcon className="w-5 h-5 mr-2 text-emerald-400" />
              Land Details
            </h2>
            <div className="space-y-6">
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
                    placeholder="e.g., 123/4"
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
                    placeholder="e.g., 2500"
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Village *
                  </label>
                  <input
                    type="text"
                    name="village"
                    value={formData.village}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
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
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    State *
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                  />
                </div>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                <h3 className="text-sm font-medium text-emerald-400 mb-3 flex items-center">
                  <MapPinIcon className="w-4 h-4 mr-2" />
                  GPS Coordinates <span className="text-red-400">*</span>
                </h3>
                <p className="text-xs text-slate-400 mb-3">Enter GPS coordinates to mark your property location on the map</p>
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
                      placeholder="e.g., 12.9716"
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
                      placeholder="e.g., 77.5946"
                      required
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                    />
                    <p className="text-xs text-slate-400 mt-1">Range: -180 to 180</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Boundary GeoJSON (Optional)
                </label>
                <textarea
                  name="boundaryGeoJSON"
                  value={formData.boundaryGeoJSON}
                  onChange={handleChange}
                  rows={4}
                  placeholder='{"type":"Polygon","coordinates":[[[lng,lat],...]]} '
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-sm transition-all duration-300"
                />
                <p className="text-xs text-slate-400 mt-1">Optional: Paste GeoJSON polygon coordinates</p>
              </div>

              <button
                onClick={() => setCurrentStep(2)}
                disabled={!formData.surveyNumber || !formData.areaSqM || !formData.village || !formData.district || !formData.state}
                className="w-full px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all duration-300 hover:scale-[1.02] glow-emerald disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center border border-emerald-400/30 font-bold"
              >
                Next: Upload Documents
                <ArrowRightIcon className="w-5 h-5 ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Documents */}
        {currentStep === 2 && (
          <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center">
              <CloudArrowUpIcon className="w-5 h-5 mr-2 text-emerald-400" />
              Upload Documents
            </h2>
            <div className="space-y-6">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-blue-400 text-sm">
                <p className="font-medium mb-1">Required Documents:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  <li>Ownership proof (Sale deed, Gift deed, etc.)</li>
                  <li>Identity proof (Aadhaar, PAN, etc.)</li>
                  <li>Survey documents or maps (if available)</li>
                </ul>
              </div>

              <DocumentUploadBox
                title="Ownership Proof"
                type="ownership_proof"
                onUpload={handleFileUpload}
                uploadedDocs={uploadedDocs.filter(d => d.type === 'ownership_proof')}
                loading={loading}
              />

              <DocumentUploadBox
                title="Identity Proof"
                type="id_proof"
                onUpload={handleFileUpload}
                uploadedDocs={uploadedDocs.filter(d => d.type === 'id_proof')}
                loading={loading}
              />

              <DocumentUploadBox
                title="Survey Documents (Optional)"
                type="survey_sketch"
                onUpload={handleFileUpload}
                uploadedDocs={uploadedDocs.filter(d => d.type === 'survey_sketch')}
                loading={loading}
                optional
              />

              <div className="flex gap-4">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="flex-1 px-6 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all duration-200 hover:scale-105 flex items-center justify-center"
                >
                  <ArrowLeftIcon className="w-5 h-5 mr-2" />
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  disabled={uploadedDocs.filter(d => d.type === 'ownership_proof').length === 0 || uploadedDocs.filter(d => d.type === 'id_proof').length === 0}
                  className="flex-1 px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all duration-300 hover:scale-[1.02] glow-emerald disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center border border-emerald-400/30"
                >
                  Next: Review
                  <ArrowRightIcon className="w-5 h-5 ml-2" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Review Your Registration</h2>
              
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-slate-400 text-sm">Survey Number</div>
                    <div className="text-white font-medium">{formData.surveyNumber}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-sm">Area</div>
                    <div className="text-white font-medium">{Number(formData.areaSqM).toFixed(0)} sq.ft</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-sm">Village</div>
                    <div className="text-white font-medium">{formData.village}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-sm">District</div>
                    <div className="text-white font-medium">{formData.district}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-sm">State</div>
                    <div className="text-white font-medium">{formData.state}</div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-700">
                  <div className="text-slate-400 text-sm mb-2">Uploaded Documents</div>
                  <div className="space-y-2">
                    {uploadedDocs.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                        <div>
                          <div className="text-white text-sm">{doc.name}</div>
                          <div className="text-slate-400 text-xs">{doc.type.replace('_', ' ')}</div>
                        </div>
                        <CheckCircleIcon className="w-5 h-5 text-green-500" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-yellow-400 text-sm mb-6">
                <ExclamationTriangleIcon className="w-5 h-5 inline mr-2" />
                Your registration will be reviewed by a government official. You'll be notified once approved.
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="flex-1 px-6 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all duration-200 hover:scale-105 flex items-center justify-center"
                >
                  <ArrowLeftIcon className="w-5 h-5 mr-2" />
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all duration-300 hover:scale-[1.02] glow-success disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center border border-green-400/30 font-bold"
                >
                  {loading ? 'Submitting...' : 'Submit Registration'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function StepIndicator({ step, currentStep, label }: { step: Step; currentStep: Step; label: string }) {
  const isActive = step === currentStep;
  const isCompleted = step < currentStep;

  return (
    <div className="flex flex-col items-center">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300 border-2 ${
        isActive ? 'bg-emerald-500 text-white border-emerald-400 glow-emerald' : isCompleted ? 'bg-green-500 text-white border-green-400 glow-success' : 'bg-slate-700 text-slate-400 border-slate-600'
      }`}>
        {isCompleted ? '✓' : step}
      </div>
      <div className={`text-sm mt-2 font-semibold ${isActive ? 'text-emerald-400' : isCompleted ? 'text-green-400' : 'text-slate-400'}`}>{label}</div>
    </div>
  );
}

function DocumentUploadBox({
  title,
  type,
  onUpload,
  uploadedDocs,
  loading,
  optional = false,
}: {
  title: string;
  type: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>, type: string) => void;
  uploadedDocs: UploadedDocument[];
  loading: boolean;
  optional?: boolean;
}) {
  return (
    <div className="border border-slate-600 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-medium">{title}</h3>
        {optional && <span className="text-xs text-slate-400">Optional</span>}
      </div>
      
      {uploadedDocs.length > 0 ? (
        <div className="space-y-2">
          {uploadedDocs.map(doc => (
            <div key={doc.id} className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div>
                <div className="text-white text-sm">{doc.name}</div>
                <div className="text-slate-400 text-xs">{(doc.size / 1024).toFixed(1)} KB</div>
              </div>
              <CheckCircleIcon className="w-5 h-5 text-green-500" />
            </div>
          ))}
        </div>
      ) : (
        <label className="block">
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={(e) => onUpload(e, type)}
            disabled={loading}
            className="hidden"
          />
          <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center cursor-pointer hover:border-emerald-500 transition-all duration-300 hover:bg-slate-700/30 hover:glow-emerald">
            <CloudArrowUpIcon className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <div className="text-slate-300 text-sm">Click to upload</div>
            <div className="text-slate-500 text-xs mt-1">PDF, JPG, PNG (Max 10MB)</div>
          </div>
        </label>
      )}
    </div>
  );
}
