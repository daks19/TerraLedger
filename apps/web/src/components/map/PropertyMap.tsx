'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { MagnifyingGlassIcon, AdjustmentsHorizontalIcon, XMarkIcon } from '@heroicons/react/24/outline';

// Dynamic import for Leaflet (client-side only)
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Polygon = dynamic(
  () => import('react-leaflet').then((mod) => mod.Polygon),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);

interface PropertyMapProps {
  center?: [number, number];
  zoom?: number;
  parcels?: Parcel[];
  onParcelSelect?: (parcel: Parcel) => void;
  height?: string;
  showControls?: boolean;
}

interface Parcel {
  id: string;
  parcelId: string;
  surveyNumber: string;
  village: string;
  district: string;
  areaSqM: number;
  status: string;
  isForSale: boolean;
  price?: number;
  boundaries?: GeoJSON.Polygon | GeoJSON.Feature;
}

export default function PropertyMap({
  center = [20.5937, 78.9629], // India center
  zoom = 5,
  parcels = [],
  onParcelSelect,
  height = '500px',
  showControls = true,
}: PropertyMapProps) {
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    forSale: false,
    priceMin: '',
    priceMax: '',
  });
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        style={{ height }}
        className="bg-slate-700 rounded-xl flex items-center justify-center"
      >
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 glow-emerald"></div>
      </div>
    );
  }

  // Filter parcels
  const filteredParcels = parcels.filter((parcel) => {
    if (filters.status !== 'all' && parcel.status !== filters.status) return false;
    if (filters.forSale && !parcel.isForSale) return false;
    if (filters.priceMin && parcel.price && parcel.price < parseFloat(filters.priceMin)) return false;
    if (filters.priceMax && parcel.price && parcel.price > parseFloat(filters.priceMax)) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        parcel.surveyNumber.toLowerCase().includes(query) ||
        parcel.village.toLowerCase().includes(query) ||
        parcel.district.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const getPolygonCoords = (parcel: Parcel): [number, number][] => {
    if (!parcel.boundaries) return [];
    
    const geometry = parcel.boundaries.type === 'Feature' 
      ? parcel.boundaries.geometry 
      : parcel.boundaries;
    
    if (geometry.type !== 'Polygon') return [];
    
    // GeoJSON uses [lng, lat], Leaflet uses [lat, lng]
    return geometry.coordinates[0].map(([lng, lat]: number[]) => [lat, lng]);
  };

  const getPolygonColor = (parcel: Parcel) => {
    if (parcel.isForSale) return '#22c55e'; // green for sale
    switch (parcel.status) {
      case 'VERIFIED': return '#3b82f6'; // blue
      case 'PENDING': return '#f59e0b'; // amber
      case 'DISPUTED': return '#ef4444'; // red
      default: return '#64748b'; // slate
    }
  };

  return (
    <div className="relative" style={{ height }}>
      {/* Search & Filter Controls */}
      {showControls && (
        <div className="absolute top-4 left-4 right-4 z-[1000] flex gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by survey number, village, or district..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/90 backdrop-blur border border-slate-200 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={`px-4 py-2 rounded-lg bg-white/90 backdrop-blur border border-slate-200 transition-all duration-300 ${
              filterOpen ? 'text-emerald-500 border-emerald-500' : 'text-slate-600'
            }`}
          >
            <AdjustmentsHorizontalIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Filter Panel */}
      {filterOpen && (
        <div className="absolute top-16 right-4 z-[1000] w-72 bg-white rounded-lg shadow-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Filters</h3>
            <button
              onClick={() => setFilterOpen(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
              >
                <option value="all">All</option>
                <option value="VERIFIED">Verified</option>
                <option value="PENDING">Pending</option>
                <option value="DISPUTED">Disputed</option>
              </select>
            </div>

            {/* For Sale Filter */}
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.forSale}
                onChange={(e) => setFilters({ ...filters, forSale: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="ml-2 text-sm text-slate-700">For Sale Only</span>
            </label>

            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Price Range (ETH)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={filters.priceMin}
                  onChange={(e) => setFilters({ ...filters, priceMin: e.target.value })}
                  placeholder="Min"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                />
                <input
                  type="number"
                  value={filters.priceMax}
                  onChange={(e) => setFilters({ ...filters, priceMax: e.target.value })}
                  placeholder="Max"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                />
              </div>
            </div>

            {/* Reset Button */}
            <button
              onClick={() => setFilters({ status: 'all', forSale: false, priceMin: '', priceMax: '' })}
              className="w-full py-2 text-sm text-emerald-500 hover:text-emerald-600 transition-colors duration-300 font-medium"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* Map */}
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Render Parcels */}
        {filteredParcels.map((parcel) => {
          const coords = getPolygonCoords(parcel);
          if (coords.length === 0) return null;

          return (
            <Polygon
              key={parcel.id}
              positions={coords}
              pathOptions={{
                color: getPolygonColor(parcel),
                fillColor: getPolygonColor(parcel),
                fillOpacity: 0.3,
                weight: 2,
              }}
              eventHandlers={{
                click: () => {
                  setSelectedParcel(parcel);
                  onParcelSelect?.(parcel);
                },
              }}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <h3 className="font-semibold text-slate-900 mb-1">
                    {parcel.surveyNumber}
                  </h3>
                  <p className="text-sm text-slate-600 mb-2">
                    {parcel.village}, {parcel.district}
                  </p>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Area:</span>
                    <span className="font-medium">{(Number(parcel.areaSqM) * 10.764).toFixed(0).toLocaleString()} sq.ft</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-slate-500">Status:</span>
                    <span className={`font-medium ${
                      parcel.status === 'VERIFIED' ? 'text-blue-600' :
                      parcel.status === 'PENDING' ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {parcel.status}
                    </span>
                  </div>
                  {parcel.isForSale && (
                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <div className="flex justify-between items-center">
                        <span className="text-green-600 font-medium">For Sale</span>
                        <span className="font-bold">{parcel.price} ETH</span>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => window.location.href = `/dashboard/parcels/${parcel.parcelId}`}
                    className="mt-3 w-full py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all duration-300 hover:scale-[1.02] font-bold"
                  >
                    View Details
                  </button>
                </div>
              </Popup>
            </Polygon>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 backdrop-blur rounded-lg p-3 text-sm">
        <div className="font-medium text-slate-900 mb-2">Legend</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-slate-600">For Sale</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-slate-600">Verified</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-slate-600">Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-slate-600">Disputed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
