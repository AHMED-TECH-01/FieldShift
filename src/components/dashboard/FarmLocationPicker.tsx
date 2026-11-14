import React, { useMemo, useRef, useState } from 'react';
import { Compass, Crosshair, MapPin, ZoomIn, ZoomOut, Globe2 } from 'lucide-react';

interface FarmLocationPickerProps {
  latitude: string;
  longitude: string;
  onChange: (lat: string, lon: string) => void;
  latError?: string;
  lonError?: string;
}

interface ViewportBox {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
  label: string;
}

const REGION_PRESETS: Array<{ id: string; label: string; box: ViewportBox }> = [
  { id: 'world', label: 'World', box: { minLon: -180, maxLon: 180, minLat: -65, maxLat: 78, label: 'Global WGS84' } },
  { id: 'na', label: 'N. America', box: { minLon: -135, maxLon: -55, minLat: 15, maxLat: 60, label: 'North America' } },
  { id: 'sa', label: 'S. America', box: { minLon: -85, maxLon: -32, minLat: -56, maxLat: 14, label: 'South America' } },
  { id: 'eu', label: 'Europe', box: { minLon: -14, maxLon: 42, minLat: 34, maxLat: 68, label: 'Europe' } },
  { id: 'af', label: 'Africa', box: { minLon: -20, maxLon: 54, minLat: -36, maxLat: 38, label: 'Africa' } },
  { id: 'as', label: 'Asia', box: { minLon: 58, maxLon: 148, minLat: 4, maxLat: 58, label: 'Asia' } },
  { id: 'au', label: 'Oceania', box: { minLon: 110, maxLon: 180, minLat: -48, maxLat: -8, label: 'Australia & NZ' } },
];

// Generalized WGS84 reference landmass silhouettes (purely cartographic orientation)
const CONTINENT_POLYGONS: Array<Array<[number, number]>> = [
  // North & Central America
  [[-168, 66], [-142, 70], [-125, 71], [-95, 70], [-80, 63], [-60, 52], [-53, 47], [-66, 44], [-75, 36], [-81, 25], [-88, 21], [-83, 9], [-78, 8], [-85, 11], [-94, 15], [-105, 20], [-115, 31], [-124, 41], [-131, 54], [-152, 60], [-168, 66]],
  // South America
  [[-78, 9], [-71, 12], [-61, 10], [-50, 1], [-35, -6], [-39, -15], [-47, -25], [-55, -34], [-63, -41], [-68, -54], [-74, -52], [-73, -38], [-71, -18], [-81, -5], [-78, 9]],
  // Europe
  [[-9, 37], [-9, 43], [-2, 44], [-5, 49], [2, 51], [8, 56], [5, 61], [16, 69], [29, 71], [42, 67], [46, 52], [39, 45], [29, 41], [23, 37], [16, 38], [12, 44], [5, 43], [-4, 36], [-9, 37]],
  // Africa
  [[-17, 15], [-13, 28], [-5, 36], [11, 37], [32, 31], [43, 12], [51, 12], [41, -2], [40, -15], [33, -27], [20, -35], [14, -22], [11, -6], [8, 4], [-8, 5], [-17, 15]],
  // Asia & Middle East
  [[28, 41], [42, 42], [48, 30], [58, 25], [68, 24], [77, 8], [86, 21], [96, 17], [103, 2], [108, 12], [120, 24], [122, 34], [131, 43], [142, 54], [160, 61], [174, 66], [140, 72], [105, 75], [70, 72], [54, 66], [46, 52], [38, 45], [28, 41]],
  // Australia
  [[114, -22], [129, -14], [136, -12], [142, -11], [146, -18], [153, -27], [150, -37], [138, -35], [128, -32], [115, -34], [114, -22]],
];

const SVG_W = 640;
const SVG_H = 320;

export const FarmLocationPicker: React.FC<FarmLocationPickerProps> = ({
  latitude,
  longitude,
  onChange,
  latError,
  lonError,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [viewport, setViewport] = useState<ViewportBox>(REGION_PRESETS[0].box);
  const [dragging, setDragging] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);

  const parsedLat = latitude.trim() !== '' && Number.isFinite(Number(latitude)) ? Number(latitude) : null;
  const parsedLon = longitude.trim() !== '' && Number.isFinite(Number(longitude)) ? Number(longitude) : null;
  const hasValidCoord =
    parsedLat !== null &&
    parsedLon !== null &&
    parsedLat >= -90 &&
    parsedLat <= 90 &&
    parsedLon >= -180 &&
    parsedLon <= 180;

  const project = (lon: number, lat: number) => {
    const x = ((lon - viewport.minLon) / (viewport.maxLon - viewport.minLon)) * SVG_W;
    const y = ((viewport.maxLat - lat) / (viewport.maxLat - viewport.minLat)) * SVG_H;
    return { x, y };
  };

  const unprojectClientPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const relX = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const relY = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    const lon = viewport.minLon + relX * (viewport.maxLon - viewport.minLon);
    const lat = viewport.maxLat - relY * (viewport.maxLat - viewport.minLat);
    return {
      lat: Number(Math.max(-90, Math.min(90, lat)).toFixed(4)),
      lon: Number(Math.max(-180, Math.min(180, lon)).toFixed(4)),
    };
  };

  const handlePointerPick = (clientX: number, clientY: number) => {
    const coords = unprojectClientPoint(clientX, clientY);
    if (!coords) return;
    setGeoNotice(null);
    onChange(coords.lat.toFixed(4), coords.lon.toFixed(4));
  };

  const zoomAroundCenter = (factor: number) => {
    const centerLon = hasValidCoord ? parsedLon! : (viewport.minLon + viewport.maxLon) / 2;
    const centerLat = hasValidCoord ? parsedLat! : (viewport.minLat + viewport.maxLat) / 2;
    const curSpanLon = viewport.maxLon - viewport.minLon;
    const curSpanLat = viewport.maxLat - viewport.minLat;
    const nextSpanLon = Math.min(360, Math.max(2, curSpanLon * factor));
    const nextSpanLat = Math.min(165, Math.max(1.5, curSpanLat * factor));

    let minLon = centerLon - nextSpanLon / 2;
    let maxLon = centerLon + nextSpanLon / 2;
    if (minLon < -180) {
      maxLon = Math.min(180, maxLon + (-180 - minLon));
      minLon = -180;
    }
    if (maxLon > 180) {
      minLon = Math.max(-180, minLon - (maxLon - 180));
      maxLon = 180;
    }

    let minLat = centerLat - nextSpanLat / 2;
    let maxLat = centerLat + nextSpanLat / 2;
    if (minLat < -85) {
      maxLat = Math.min(85, maxLat + (-85 - minLat));
      minLat = -85;
    }
    if (maxLat > 85) {
      minLat = Math.max(-85, minLat - (maxLat - 85));
      maxLat = 85;
    }

    setViewport({
      minLon,
      maxLon,
      minLat,
      maxLat,
      label: nextSpanLon > 260 ? 'Global WGS84' : `${nextSpanLon.toFixed(1)}° view`,
    });
  };

  const handleUseBrowserLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoNotice('Browser geolocation is unavailable in this environment. Click the map or enter coordinates manually.');
      return;
    }
    setGeoLoading(true);
    setGeoNotice(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lon = Number(pos.coords.longitude.toFixed(4));
        onChange(lat.toFixed(4), lon.toFixed(4));
        setViewport({
          minLon: Math.max(-180, lon - 12),
          maxLon: Math.min(180, lon + 12),
          minLat: Math.max(-85, lat - 6),
          maxLat: Math.min(85, lat + 6),
          label: 'Device GPS Region',
        });
        setGeoLoading(false);
        setGeoNotice('Coordinates captured from browser geolocation. Drag the pin to refine parcel center.');
      },
      (err) => {
        setGeoLoading(false);
        setGeoNotice(
          err.code === 1
            ? 'Location permission declined. Click anywhere on the map or enter decimal Latitude & Longitude.'
            : 'Unable to determine browser GPS coordinates. Please select the location on the map.'
        );
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const graticuleLines = useMemo(() => {
    const lonSpan = viewport.maxLon - viewport.minLon;
    const step = lonSpan > 160 ? 30 : lonSpan > 60 ? 15 : lonSpan > 20 ? 5 : 1;
    const lonTicks: number[] = [];
    const latTicks: number[] = [];
    for (let lon = Math.ceil(viewport.minLon / step) * step; lon <= viewport.maxLon; lon += step) {
      lonTicks.push(Number(lon.toFixed(2)));
    }
    for (let lat = Math.ceil(viewport.minLat / step) * step; lat <= viewport.maxLat; lat += step) {
      latTicks.push(Number(lat.toFixed(2)));
    }
    return { lonTicks, latTicks };
  }, [viewport]);

  const pinPos = hasValidCoord ? project(parsedLon!, parsedLat!) : null;
  const pinInBounds =
    pinPos !== null && pinPos.x >= -10 && pinPos.x <= SVG_W + 10 && pinPos.y >= -10 && pinPos.y <= SVG_H + 10;

  return (
    <div className="rounded-2xl border border-[#CDE5BA] bg-[#FAFDF8] p-3.5 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold text-[#073D2B] flex items-center gap-1.5">
            <Globe2 className="w-3.5 h-3.5 text-[#76B93F]" />
            <span>Interactive WGS84 Coordinate Map Picker *</span>
          </h4>
          <p className="text-[11px] text-[#527367]">
            Click or drag on the map to pin parcel coordinates for NASA POWER &amp; MODIS lookup, or enter decimals below.
          </p>
        </div>

        <button
          type="button"
          onClick={handleUseBrowserLocation}
          disabled={geoLoading}
          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white border border-[#D5E5CA] hover:bg-[#EAF5DF] text-[11px] font-bold text-[#073D2B] inline-flex items-center gap-1.5 disabled:opacity-60"
        >
          <Crosshair className="w-3.5 h-3.5 text-[#145C3D]" />
          <span>{geoLoading ? 'Locating...' : 'Use My Current Location'}</span>
        </button>
      </div>

      {/* Region zoom presets + Zoom controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {REGION_PRESETS.map((preset) => {
            const active = viewport.label === preset.box.label;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setViewport(preset.box)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                  active
                    ? 'bg-[#073D2B] text-white'
                    : 'bg-white border border-[#E2E8DE] text-[#2A4D3E] hover:border-[#76B93F]'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => zoomAroundCenter(0.55)}
            title="Zoom in"
            aria-label="Zoom in map"
            className="w-8 h-8 rounded-lg bg-white border border-[#D5E5CA] hover:bg-[#EAF5DF] text-[#073D2B] flex items-center justify-center"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => zoomAroundCenter(1.75)}
            title="Zoom out"
            aria-label="Zoom out map"
            className="w-8 h-8 rounded-lg bg-white border border-[#D5E5CA] hover:bg-[#EAF5DF] text-[#073D2B] flex items-center justify-center"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive SVG Map */}
      <div className="relative rounded-xl overflow-hidden border border-[#145C3D]/40 bg-[#102E24] select-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-44 sm:h-52 block cursor-crosshair touch-none"
          role="img"
          aria-label="Interactive WGS84 farm coordinate picker map"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
            handlePointerPick(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (!dragging) return;
            handlePointerPick(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            if (dragging) {
              setDragging(false);
              try {
                e.currentTarget.releasePointerCapture(e.pointerId);
              } catch {
                // ignore
              }
            }
          }}
          onPointerCancel={() => setDragging(false)}
        >
          {/* Ocean backdrop */}
          <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="#0F2D23" />

          {/* Graticule Grid */}
          {graticuleLines.lonTicks.map((lon) => {
            const { x } = project(lon, 0);
            return (
              <g key={`lon-${lon}`}>
                <line x1={x} y1={0} x2={x} y2={SVG_H} stroke="#1D4A3A" strokeWidth={0.75} strokeDasharray="3 3" />
                <text x={x + 2} y={SVG_H - 4} fill="#7CA895" fontSize="8" fontFamily="monospace">
                  {lon}°
                </text>
              </g>
            );
          })}
          {graticuleLines.latTicks.map((lat) => {
            const { y } = project(0, lat);
            return (
              <g key={`lat-${lat}`}>
                <line
                  x1={0}
                  y1={y}
                  x2={SVG_W}
                  y2={y}
                  stroke={lat === 0 ? '#32705A' : '#1D4A3A'}
                  strokeWidth={lat === 0 ? 1 : 0.75}
                  strokeDasharray={lat === 0 ? undefined : '3 3'}
                />
                <text x={4} y={Math.max(10, y - 2)} fill="#7CA895" fontSize="8" fontFamily="monospace">
                  {lat}°
                </text>
              </g>
            );
          })}

          {/* Generalized Landmass Polygons */}
          {CONTINENT_POLYGONS.map((poly, idx) => {
            const pts = poly
              .map(([lon, lat]) => {
                const { x, y } = project(lon, lat);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(' ');
            return (
              <polygon
                key={idx}
                points={pts}
                fill="#1D5941"
                stroke="#428766"
                strokeWidth={1}
                fillOpacity={0.9}
              />
            );
          })}

          {/* Selected Pin Marker */}
          {pinPos && pinInBounds && (
            <g transform={`translate(${pinPos.x}, ${pinPos.y})`}>
              <circle r={12} fill="#76B93F" fillOpacity={0.28} />
              <circle r={5} fill="#9BD85A" stroke="#073D2B" strokeWidth={1.75} />
              <line x1={-9} y1={0} x2={9} y2={0} stroke="#FAFDF8" strokeWidth={0.8} strokeOpacity={0.7} />
              <line x1={0} y1={-9} x2={0} y2={9} stroke="#FAFDF8" strokeWidth={0.8} strokeOpacity={0.7} />
            </g>
          )}
        </svg>

        {/* Bottom HUD */}
        <div className="px-3 py-1.5 bg-[#073D2B]/90 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white">
          <span className="flex items-center gap-1.5 font-mono tabular-nums">
            <Compass className="w-3.5 h-3.5 text-[#76B93F]" />
            {hasValidCoord ? (
              <span>
                Selected: {Math.abs(parsedLat!).toFixed(4)}° {parsedLat! >= 0 ? 'N' : 'S'},{' '}
                {Math.abs(parsedLon!).toFixed(4)}° {parsedLon! >= 0 ? 'E' : 'W'}
              </span>
            ) : (
              <span className="text-amber-200">No coordinates pinned yet</span>
            )}
          </span>
          <span className="text-[10px] text-[#9BD85A] font-medium">{viewport.label}</span>
        </div>
      </div>

      {geoNotice && (
        <p className="text-[11px] text-[#145C3D] bg-[#EAF5DF] border border-[#CDE5BA] rounded-lg px-2.5 py-1.5">
          {geoNotice}
        </p>
      )}

      {/* Manual Coordinate Inputs Synced Bidirectionally */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <label htmlFor="farm-lat-input" className="block font-bold text-[#073D2B] mb-1">
            Latitude (-90 to 90) *
          </label>
          <div className="relative">
            <MapPin className="w-3.5 h-3.5 text-[#527367] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="farm-lat-input"
              type="number"
              step="0.0001"
              min="-90"
              max="90"
              value={latitude}
              onChange={(e) => onChange(e.target.value, longitude)}
              placeholder="e.g., 42.0308"
              className={`w-full min-h-[42px] pl-8 pr-3 py-2 rounded-xl border bg-white text-sm sm:text-xs text-[#073D2B] tabular-nums focus:outline-hidden focus:ring-2 focus:ring-[#76B93F] ${
                latError ? 'border-rose-400' : 'border-[#D5E5CA]'
              }`}
            />
          </div>
          {latError && <p className="text-[11px] text-rose-700 mt-1 font-medium">{latError}</p>}
        </div>

        <div>
          <label htmlFor="farm-lon-input" className="block font-bold text-[#073D2B] mb-1">
            Longitude (-180 to 180) *
          </label>
          <div className="relative">
            <MapPin className="w-3.5 h-3.5 text-[#527367] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="farm-lon-input"
              type="number"
              step="0.0001"
              min="-180"
              max="180"
              value={longitude}
              onChange={(e) => onChange(latitude, e.target.value)}
              placeholder="e.g., -93.6200"
              className={`w-full min-h-[42px] pl-8 pr-3 py-2 rounded-xl border bg-white text-sm sm:text-xs text-[#073D2B] tabular-nums focus:outline-hidden focus:ring-2 focus:ring-[#76B93F] ${
                lonError ? 'border-rose-400' : 'border-[#D5E5CA]'
              }`}
            />
          </div>
          {lonError && <p className="text-[11px] text-rose-700 mt-1 font-medium">{lonError}</p>}
        </div>
      </div>
    </div>
  );
};
