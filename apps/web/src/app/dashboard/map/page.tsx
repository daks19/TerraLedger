'use client';

import { useEffect, useState, useRef } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/components/Providers';
import {
  MapPinIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Dynamically import map component to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

// Custom map icon - emerald pin
const createCustomIcon = () => {
  if (typeof window === 'undefined') return null;
  const L = require('leaflet');
  return L.divIcon({
    html: `<div style="background-color: #10b981; width: 24px; height: 24px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"><div style="width: 8px; height: 8px; background: white; border-radius: 50%; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(45deg);"></div></div>`,
    className: 'custom-map-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24]
  });
};

interface Parcel {
  id: string;
  parcelId: string;
  surveyNumber: string;
  areaSqM: number;
  village: string;
  district: string;
  state: string;
  status: string;
  latitude?: number;
  longitude?: number;
}

// Demo coordinates for seeded parcels (DB doesn't store lat/lng yet)
const demoCoordinatesByParcelId: Record<string, { latitude: number; longitude: number }> = {
  'TL-MH-001': { latitude: 19.1136, longitude: 72.8697 },
  'TL-MH-002': { latitude: 19.0596, longitude: 72.8295 },
  'TL-KA-001': { latitude: 12.9698, longitude: 77.75 },
  'TL-DL-001': { latitude: 28.5921, longitude: 77.046 },
};

const demoFallbackParcels: Parcel[] = [
  {
    id: '1',
    parcelId: 'TL-MH-001',
    surveyNumber: 'SN-2024-001',
    areaSqM: 5000,
    village: 'Andheri',
    district: 'Mumbai',
    state: 'Maharashtra',
    status: 'VERIFIED',
    latitude: 19.1136,
    longitude: 72.8697,
  },
  {
    id: '2',
    parcelId: 'TL-MH-002',
    surveyNumber: 'SN-2024-002',
    areaSqM: 2500,
    village: 'Bandra',
    district: 'Mumbai',
    state: 'Maharashtra',
    status: 'VERIFIED',
    latitude: 19.0596,
    longitude: 72.8295,
  },
  {
    id: '3',
    parcelId: 'TL-KA-001',
    surveyNumber: 'SN-2024-003',
    areaSqM: 8000,
    village: 'Whitefield',
    district: 'Bangalore',
    state: 'Karnataka',
    status: 'PENDING',
    latitude: 12.9698,
    longitude: 77.7500,
  },
  {
    id: '4',
    parcelId: 'TL-DL-001',
    surveyNumber: 'SN-2024-004',
    areaSqM: 3500,
    village: 'Dwarka',
    district: 'New Delhi',
    state: 'Delhi',
    status: 'VERIFIED',
    latitude: 28.5921,
    longitude: 77.0460,
  },
];

export default function DashboardMapPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ADMIN') || user?.roles?.includes('GOVERNMENT_OFFICIAL');
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [customIcon, setCustomIcon] = useState<any>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    // Create custom pin icon
    setCustomIcon(createCustomIcon());
    
    setMapReady(true);
    
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchParcels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin]);

  // Handle parcel selection from URL query params
  useEffect(() => {
    if (typeof window !== 'undefined' && parcels.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const parcelParam = params.get('parcel');
      if (parcelParam && !selectedParcel) {
        const parcel = parcels.find(p => p.parcelId === parcelParam);
        if (parcel) {
          setSelectedParcel(parcel);
        }
      }
    }
  }, [parcels, selectedParcel]);

  const fetchParcels = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('accessToken');
      const endpoint = isAdmin ? '/api/land/all' : '/api/land/my-parcels';
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        
        // Get all demo coordinates as array for cycling through
        const demoCoords = Object.values(demoCoordinatesByParcelId);
        
        const enriched: Parcel[] = (Array.isArray(data) ? data : []).map((p: any, idx: number) => {
          // Priority 1: Use DB coordinates if available
          if (p.latitude && p.longitude) {
            return { ...p };
          }
          
          // Priority 2: Use demo coordinates if parcelId matches
          const demo = demoCoordinatesByParcelId[p.parcelId];
          if (demo) {
            return {
              ...p,
              latitude: demo.latitude,
              longitude: demo.longitude,
            };
          }
          
          // Priority 3: Cycle through demo coordinates for parcels without mapping
          const fallbackCoord = demoCoords[idx % demoCoords.length];
          return {
            ...p,
            latitude: fallbackCoord.latitude,
            longitude: fallbackCoord.longitude,
          };
        });

        setParcels(enriched.length > 0 ? enriched : demoFallbackParcels);
      } else {
        setParcels(demoFallbackParcels);
      }
    } catch (error) {
      console.error('Failed to fetch parcels:', error);
      setParcels(demoFallbackParcels);
    } finally {
      setLoading(false);
    }
  };

  const filteredParcels = parcels.filter((parcel) => {
    const term = searchTerm.toLowerCase();
    return (
      (parcel.parcelId || '').toLowerCase().includes(term) ||
      (parcel.village || '').toLowerCase().includes(term) ||
      (parcel.district || '').toLowerCase().includes(term)
    );
  });

  // Center map on selected parcel or first available parcel or default to India
  const mapCenter: [number, number] = selectedParcel?.latitude && selectedParcel?.longitude
    ? [selectedParcel.latitude, selectedParcel.longitude]
    : filteredParcels.length > 0 && filteredParcels[0].latitude && filteredParcels[0].longitude
    ? [filteredParcels[0].latitude, filteredParcels[0].longitude]
    : [20.5937, 78.9629]; // Center of India
  
  const mapZoom = selectedParcel ? 12 : filteredParcels.length > 0 ? 10 : 5;

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Property Map</h1>
            <p className="text-slate-400">View your properties on an interactive map</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100%-5rem)]">
          {/* Sidebar - Property List */}
          <div className="lg:w-80 flex-shrink-0 space-y-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search properties..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
              />
            </div>

            {/* Property List */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden h-[calc(100%-4rem)]">
              <div className="p-3 border-b border-slate-700">
                <span className="text-slate-400 text-sm">{filteredParcels.length} properties</span>
              </div>
              <div className="overflow-y-auto h-[calc(100%-3rem)]">
                {loading ? (
                  <div className="p-4 text-center text-slate-400">Loading...</div>
                ) : filteredParcels.length === 0 ? (
                  <div className="p-4 text-center text-slate-400">No properties found</div>
                ) : (
                  <div className="divide-y divide-slate-700">
                    {filteredParcels.map((parcel, idx) => (
                      <button
                        key={parcel.id}
                        onClick={() => setSelectedParcel(parcel)}
                        className={`w-full p-4 text-left hover:bg-slate-700/50 transition ${
                          selectedParcel?.id === parcel.id ? 'bg-slate-700' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                            <MapPinIcon className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium truncate">{parcel.parcelId}</div>
                            <div className="text-slate-400 text-sm truncate">
                              {parcel.village}, {parcel.district}
                            </div>
                            <div className="text-slate-500 text-xs mt-1">
                              {(parcel.areaSqM * 10.764).toFixed(0).toLocaleString()} sq.ft
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            parcel.status === 'VERIFIED' ? 'bg-green-500/20 text-green-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {parcel.status}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Map Area */}
          <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden relative">
            {/* Leaflet Map */}
            {mapReady && (
              <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                style={{ width: '100%', height: '100%' }}
                key={selectedParcel?.id || 'default'}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {parcels.map((parcel) => (
                  parcel.latitude && parcel.longitude && (
                    <Marker
                      key={parcel.id}
                      position={[parcel.latitude, parcel.longitude]}
                      {...(customIcon ? { icon: customIcon } : {})}
                      eventHandlers={{
                        click: () => setSelectedParcel(parcel),
                      }}
                    >
                      <Popup>
                        <div className="text-sm">
                          <strong>{parcel.parcelId}</strong><br />
                          {parcel.village}, {parcel.district}<br />
                          {(parcel.areaSqM * 10.764).toFixed(0).toLocaleString()} sq.ft
                        </div>
                      </Popup>
                    </Marker>
                  )
                ))}
              </MapContainer>
            )}

            {/* Selected Property Info Card */}
            {selectedParcel && (
              <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-xl z-[1000]">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-white font-semibold">{selectedParcel.parcelId}</h3>
                    <p className="text-slate-400 text-sm">{selectedParcel.surveyNumber}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded ${
                    selectedParcel.status === 'VERIFIED' ? 'bg-green-500/20 text-green-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {selectedParcel.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div>
                    <span className="text-slate-400">Location</span>
                    <p className="text-white">{selectedParcel.village}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">District</span>
                    <p className="text-white">{selectedParcel.district}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">State</span>
                    <p className="text-white">{selectedParcel.state}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Area</span>
                    <p className="text-white">{(selectedParcel.areaSqM * 10.764).toFixed(0).toLocaleString()} sq.ft</p>
                  </div>
                </div>
                <Link
                  href={`/dashboard/parcels/${selectedParcel.parcelId}`}
                  className="block w-full px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-center transition-all duration-300 hover:scale-[1.02] glow-emerald font-bold"
                >
                  View Full Details
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
