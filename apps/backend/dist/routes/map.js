"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
const ipfs_1 = require("../services/ipfs");
const router = (0, express_1.Router)();
exports.mapRouter = router;
const prisma = new client_1.PrismaClient();
const ipfsService = new ipfs_1.IPFSService();
// GET /api/map/boundaries/:parcelId
router.get('/boundaries/:parcelId', async (req, res) => {
    try {
        const { parcelId } = req.params;
        const parcel = await prisma.landParcel.findUnique({
            where: { parcelId },
            select: { boundaryHash: true },
        });
        if (!parcel) {
            return res.status(404).json({ error: 'Parcel not found' });
        }
        if (!parcel.boundaryHash) {
            return res.status(404).json({ error: 'No boundary data available' });
        }
        // Fetch from IPFS
        const geoJSON = await ipfsService.getContent(parcel.boundaryHash);
        res.json(geoJSON);
    }
    catch (error) {
        logger_1.logger.error('Get boundaries error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/map/validate
router.post('/validate', async (req, res) => {
    try {
        const { parcelId, boundaryGeoJSON } = req.body;
        if (!parcelId || !boundaryGeoJSON) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        let boundary;
        try {
            boundary = typeof boundaryGeoJSON === 'string'
                ? JSON.parse(boundaryGeoJSON)
                : boundaryGeoJSON;
        }
        catch {
            return res.status(400).json({ error: 'Invalid GeoJSON format' });
        }
        // Basic validation
        const validationResult = validateGeoJSON(boundary);
        if (!validationResult.isValid) {
            return res.status(400).json({
                error: 'Invalid boundary',
                details: validationResult.errors
            });
        }
        // Check for overlaps with other parcels
        // In production, this would use PostGIS spatial queries
        const overlaps = await checkOverlaps(parcelId, boundary);
        if (overlaps.length > 0) {
            return res.json({
                isValid: false,
                hasOverlaps: true,
                overlappingParcels: overlaps,
            });
        }
        res.json({
            isValid: true,
            hasOverlaps: false,
            message: 'Boundary validation passed',
        });
    }
    catch (error) {
        logger_1.logger.error('Validate boundaries error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/map/parcels-in-bounds
router.get('/parcels-in-bounds', async (req, res) => {
    try {
        const { minLat, minLng, maxLat, maxLng } = req.query;
        if (!minLat || !minLng || !maxLat || !maxLng) {
            return res.status(400).json({ error: 'Missing bounding box coordinates' });
        }
        // In production, use PostGIS spatial query:
        // SELECT * FROM land_parcels 
        // WHERE ST_Intersects(geom, ST_MakeEnvelope(minLng, minLat, maxLng, maxLat, 4326))
        // For now, return all parcels with boundaries
        const parcels = await prisma.landParcel.findMany({
            where: {
                boundaryHash: { not: null },
            },
            select: {
                parcelId: true,
                surveyNumber: true,
                village: true,
                district: true,
                areaSqM: true,
                isForSale: true,
                price: true,
                status: true,
                boundaryHash: true,
            },
            take: 100, // Limit for performance
        });
        // Fetch boundaries from IPFS and filter
        const parcelsWithBoundaries = await Promise.all(parcels.map(async (parcel) => {
            try {
                const boundaries = await ipfsService.getContent(parcel.boundaryHash);
                return {
                    ...parcel,
                    boundaries,
                };
            }
            catch {
                return {
                    ...parcel,
                    boundaries: null,
                };
            }
        }));
        res.json({
            parcels: parcelsWithBoundaries.filter(p => p.boundaries !== null),
            count: parcelsWithBoundaries.filter(p => p.boundaries !== null).length,
        });
    }
    catch (error) {
        logger_1.logger.error('Get parcels in bounds error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/map/search
router.get('/search', async (req, res) => {
    try {
        const { lat, lng, radius } = req.query;
        if (!lat || !lng) {
            return res.status(400).json({ error: 'Missing coordinates' });
        }
        const radiusKm = parseFloat(radius) || 1; // Default 1km radius
        // In production, use PostGIS:
        // SELECT * FROM land_parcels 
        // WHERE ST_DWithin(
        //   geom::geography, 
        //   ST_Point(lng, lat)::geography, 
        //   radius * 1000
        // )
        // For demo, return nearby parcels based on district
        const parcels = await prisma.landParcel.findMany({
            where: {
                boundaryHash: { not: null },
            },
            include: {
                owner: {
                    select: { walletAddress: true, name: true },
                },
            },
            take: 50,
        });
        res.json({ parcels });
    }
    catch (error) {
        logger_1.logger.error('Map search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/map/calculate-area
router.post('/calculate-area', async (req, res) => {
    try {
        const { boundaryGeoJSON } = req.body;
        if (!boundaryGeoJSON) {
            return res.status(400).json({ error: 'Missing boundary data' });
        }
        let boundary;
        try {
            boundary = typeof boundaryGeoJSON === 'string'
                ? JSON.parse(boundaryGeoJSON)
                : boundaryGeoJSON;
        }
        catch {
            return res.status(400).json({ error: 'Invalid GeoJSON format' });
        }
        // Calculate area using spherical geometry
        const area = calculateSphericalArea(boundary);
        res.json({
            areaSqM: area,
            areaSqFt: area * 10.7639,
            areaHectares: area / 10000,
            areaAcres: area / 4046.86,
        });
    }
    catch (error) {
        logger_1.logger.error('Calculate area error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Helper functions
function validateGeoJSON(geoJSON) {
    const errors = [];
    if (!geoJSON) {
        errors.push('GeoJSON is required');
        return { isValid: false, errors };
    }
    if (!geoJSON.type) {
        errors.push('GeoJSON type is required');
    }
    const validTypes = ['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon', 'GeometryCollection', 'Feature', 'FeatureCollection'];
    if (!validTypes.includes(geoJSON.type)) {
        errors.push(`Invalid GeoJSON type: ${geoJSON.type}`);
    }
    if (geoJSON.type === 'Polygon' || geoJSON.type === 'Feature') {
        const coordinates = geoJSON.type === 'Feature'
            ? geoJSON.geometry?.coordinates
            : geoJSON.coordinates;
        if (!coordinates || !Array.isArray(coordinates)) {
            errors.push('Invalid coordinates');
        }
        else if (coordinates.length < 1) {
            errors.push('Polygon must have at least one ring');
        }
        else {
            const ring = coordinates[0];
            if (ring.length < 4) {
                errors.push('Polygon ring must have at least 4 positions');
            }
            // Check if ring is closed
            const first = ring[0];
            const last = ring[ring.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
                errors.push('Polygon ring must be closed');
            }
            // Validate coordinate values
            for (const coord of ring) {
                if (!Array.isArray(coord) || coord.length < 2) {
                    errors.push('Invalid coordinate format');
                    break;
                }
                const [lng, lat] = coord;
                if (lng < -180 || lng > 180) {
                    errors.push(`Invalid longitude: ${lng}`);
                    break;
                }
                if (lat < -90 || lat > 90) {
                    errors.push(`Invalid latitude: ${lat}`);
                    break;
                }
            }
        }
    }
    return { isValid: errors.length === 0, errors };
}
async function checkOverlaps(parcelId, boundary) {
    // In production, use PostGIS ST_Overlaps function
    // This is a placeholder implementation
    const overlappingParcels = [];
    // Get all other parcels
    const parcels = await prisma.landParcel.findMany({
        where: {
            parcelId: { not: parcelId },
            boundaryHash: { not: null },
        },
        select: {
            parcelId: true,
            boundaryHash: true,
        },
    });
    // In production, check each parcel's boundary for overlap
    // using PostGIS or Turf.js
    return overlappingParcels;
}
function calculateSphericalArea(geoJSON) {
    // Simple area calculation using spherical excess formula
    // In production, use Turf.js or PostGIS for accurate calculation
    const coordinates = geoJSON.type === 'Feature'
        ? geoJSON.geometry?.coordinates[0]
        : geoJSON.coordinates?.[0];
    if (!coordinates || coordinates.length < 4) {
        return 0;
    }
    const EARTH_RADIUS = 6371000; // meters
    // Convert to radians and calculate
    let area = 0;
    const n = coordinates.length - 1; // Last point is same as first
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const lat1 = coordinates[i][1] * Math.PI / 180;
        const lat2 = coordinates[j][1] * Math.PI / 180;
        const lng1 = coordinates[i][0] * Math.PI / 180;
        const lng2 = coordinates[j][0] * Math.PI / 180;
        area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    area = Math.abs(area * EARTH_RADIUS * EARTH_RADIUS / 2);
    return Math.round(area * 100) / 100;
}
//# sourceMappingURL=map.js.map