import React, { useState, useEffect } from 'react';
import { Satellite, Database, ShieldCheck, Activity, AlertCircle, Compass, Layers, CheckCircle2, BookOpen, RefreshCw, CloudDownload } from 'lucide-react';
import { NasaHarmonizedDataset } from '../../types';
import { apiClient } from '../../services/apiClient';

interface NasaRoadmapExplorerProps {
  farmId?: string;
  farmName?: string;
  onSynced?: () => void;
}

export const NasaRoadmapExplorer: React.FC<NasaRoadmapExplorerProps> = ({ farmId, farmName, onSynced }) => {
  const [datasets, setDatasets] = useState<NasaHarmonizedDataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<NasaHarmonizedDataset | null>(null);
  const [scientificMethods, setScientificMethods] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'catalog' | 'harmonization' | 'methods'>('catalog');
  const [loading, setLoading] = useState(true);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchRoadmap();
    fetchMethods();
  }, []);

  useEffect(() => {
    if (farmId) {
      fetchSyncStatus();
    }
  }, [farmId]);

  const fetchRoadmap = async () => {
    try {
      const data = await apiClient.get('/api/nasa/roadmap');
      if (data.datasets) {
        setDatasets(data.datasets);
        setSelectedDataset(data.datasets[0]);
      }
    } catch (e) {
      console.error('Failed to load NASA roadmap', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMethods = async () => {
    try {
      const data = await apiClient.get('/api/scientific-methods');
      if (data.methods) {
        setScientificMethods(data.methods);
      }
    } catch (e) {
      console.error('Failed to load scientific methods', e);
    }
  };

  const fetchSyncStatus = async () => {
    if (!farmId) return;
    try {
      const data = await apiClient.get('/api/datasets/status', { params: { farmId } });
      if (Array.isArray(data.recentJobs)) {
        setRecentJobs(data.recentJobs);
      }
    } catch {
      // Ignore status load errors cleanly
    }
  };

  const handleSyncDataset = async (datasetId: string) => {
    if (!farmId) return;
    const syncable = ['nasa-power', 'smap', 'gpm', 'modis', 'ecostress'];
    if (!syncable.includes(datasetId)) return;
    setSyncingId(datasetId);
    setSyncNotice(null);
    try {
      const res = await apiClient.post(`/api/datasets/${datasetId}/sync`, { farmId, days: 30 });
      const isPartialModis = datasetId === 'modis' && res.status === 'partial';
      setSyncNotice({
        type: isPartialModis ? 'error' : 'success',
        message:
          datasetId === 'nasa-power'
            ? `Synced ${res.recordsSaved || 0} live NASA POWER agroclimatology records (${res.startDate} to ${res.endDate}).`
            : datasetId === 'modis'
            ? isPartialModis
              ? `Indexed ${res.granulesFound ?? 0} Earthdata CMR granules for MODIS, but ORNL DAAC numeric pixel API failed (${res.ornlError || 'upstream timeout'}).`
              : `Synced ${res.numericPixelCount || 0} live MODIS 250m/1km pixel records + ${res.granulesFound ?? 0} Earthdata CMR granules.`
            : `Discovered ${res.granulesFound ?? res.recordsSaved ?? 0} Earthdata CMR granule metadata entries for ${datasetId.toUpperCase()} (metadata-only; numeric raster extraction unavailable).`,
      });
      await fetchSyncStatus();
      onSynced?.();
    } catch (err: any) {
      const msg =
        err?.status === 401
          ? 'Not authenticated or session expired (401). Please sign in again.'
          : err?.status === 403
          ? 'Unauthorized farm access (403).'
          : err?.status === 404
          ? 'Farm parcel not found (404).'
          : err?.message || `Failed to sync ${datasetId}.`;
      setSyncNotice({
        type: 'error',
        message: msg,
      });
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-8 border border-[#D5E5CA] shadow-sm space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E2E8DE] pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF5DF] text-[#145C3D] text-xs font-bold uppercase tracking-wider mb-2">
            <Satellite className="w-3.5 h-3.5 shrink-0" />
            <span>Requirements F & G: NASA Data Pipeline</span>
          </div>
          <h3 className="font-display text-fluid-h2 font-bold text-[#073D2B]">
            Multi-Mission Earth Science Architecture
          </h3>
          <p className="text-xs text-[#527367] mt-1 max-w-2xl">
            Supported 8-mission satellite catalog, harmonization data pipeline, and peer-reviewed mathematical methodologies.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-[#E7EFE6] p-1 rounded-2xl sm:rounded-full self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`min-h-[40px] px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === 'catalog' ? 'bg-white text-[#073D2B] shadow-xs' : 'text-[#527367]'
            }`}
          >
            8 NASA Datasets
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('harmonization')}
            className={`min-h-[40px] px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === 'harmonization' ? 'bg-white text-[#073D2B] shadow-xs' : 'text-[#527367]'
            }`}
          >
            Harmonization
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('methods')}
            className={`min-h-[40px] px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === 'methods' ? 'bg-white text-[#073D2B] shadow-xs' : 'text-[#527367]'
            }`}
          >
            Scientific Formulas
          </button>
        </div>
      </div>

      {/* Satellite Earth Observation Visual Telemetry Banner */}
      <div className="relative w-full min-h-[192px] sm:min-h-[224px] rounded-2xl overflow-hidden border border-[#D5E5CA] shadow-sm bg-[#073D2B] flex items-end">
        <img
          src="/images/satellite-telemetry.jpg"
          alt="NASA Earth observation satellite in orbit scanning agricultural land with multi-spectral sensor grid and telemetry overlays"
          width="1200"
          height="675"
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover opacity-85"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#073D2B]/95 via-[#073D2B]/75 to-[#073D2B]/35" />
        <div className="relative z-10 p-4 sm:p-6 max-w-lg text-white">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#76B93F] text-[#073D2B] text-[10px] font-bold mb-1.5 uppercase tracking-wider">
            NASA Planetary Fleet Telemetry
          </div>
          <h4 className="font-display text-base sm:text-xl font-bold leading-snug">
            Multi-Spectral Agricultural Observation from Low Earth Orbit
          </h4>
          <p className="text-[11px] sm:text-xs text-white/85 mt-1 leading-relaxed">
            Ingesting active &amp; passive microwave radiometry (SMAP L4), radar rainfall scans (GPM IMERG), and multispectral canopy reflectance (MODIS/Landsat) down to field parcel scales.
          </p>
        </div>
      </div>

      {/* TAB 1: 8 NASA DATASETS ROADMAP */}
      {activeTab === 'catalog' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left: Mission Pill List */}
          <div className="lg:col-span-5 space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {datasets.map((d) => {
              const isSelected = selectedDataset?.id === d.id;
              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedDataset(d)}
                  className={`p-3.5 rounded-2xl cursor-pointer border transition-all text-left ${
                    isSelected
                      ? 'bg-[#F2F8ED] border-[#76B93F] ring-2 ring-[#76B93F]/20 shadow-xs'
                      : 'bg-white border-[#E2E8DE] hover:border-[#BAC9BE]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-[#073D2B]">{d.code}</span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                        d.dataCategory === 'Ground Truth Calibrated'
                          ? 'bg-blue-100 text-blue-800'
                          : d.dataCategory === 'Model Assimilated'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {d.dataCategory}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-[#073D2B] truncate">{d.name}</h4>
                  <div className="flex items-center justify-between text-[10px] text-[#527367] mt-1 pt-1 border-t border-[#E2E8DE]/60">
                    <span>Res: {d.spatialResolution.split('(')[0]}</span>
                    <span>Units: {d.units.split('(')[0]}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Detailed Dataset Inspector */}
          {selectedDataset && (
            <div className="lg:col-span-7 bg-[#FAFDF8] rounded-3xl p-4 sm:p-6 border border-[#D5E5CA] space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#E2E8DE] pb-3">
                <div className="min-w-0">
                  <span className="px-2.5 py-0.5 rounded bg-[#073D2B] text-white text-[10px] font-mono font-bold">
                    {selectedDataset.code}
                  </span>
                  <h4 className="font-bold text-base sm:text-lg text-[#073D2B] mt-1">{selectedDataset.name}</h4>
                  <p className="text-xs text-[#527367]">{selectedDataset.source}</p>
                </div>
                <span className="text-[10px] bg-white border border-[#E2E8DE] px-2 py-1 rounded text-[#145C3D] font-mono font-bold">
                  {selectedDataset.dataCategory}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white rounded-xl border border-[#E2E8DE]">
                  <span className="text-[#527367] block text-[10px]">Spatial Resolution</span>
                  <span className="font-bold text-[#073D2B]">{selectedDataset.spatialResolution}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-[#E2E8DE]">
                  <span className="text-[#527367] block text-[10px]">Temporal Resolution</span>
                  <span className="font-bold text-[#073D2B]">{selectedDataset.temporalResolution}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-[#E2E8DE]">
                  <span className="text-[#527367] block text-[10px]">Measurement Units</span>
                  <span className="font-bold text-[#073D2B]">{selectedDataset.units}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-[#E2E8DE]">
                  <span className="text-[#527367] block text-[10px]">Archive Baseline</span>
                  <span className="font-bold text-[#073D2B]">{selectedDataset.observationPeriod}</span>
                </div>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-[#E2E8DE] text-xs space-y-1">
                <span className="font-bold text-[#145C3D] uppercase text-[10px] block">Analytical Purpose</span>
                <p className="text-[#2A4D3E]">{selectedDataset.analyticalPurpose}</p>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-[#E2E8DE] text-xs space-y-1">
                <span className="font-bold text-[#145C3D] uppercase text-[10px] block">Processing Pipeline & Harmonization</span>
                <p className="text-[#2A4D3E]">{selectedDataset.processingMethod}</p>
              </div>

              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Documented Limitations:</strong> {selectedDataset.limitations}
                </div>
              </div>

              {farmId && ['nasa-power', 'smap', 'gpm', 'modis', 'ecostress'].includes(selectedDataset.id) && (
                <div className="p-3.5 bg-white rounded-xl border border-[#D5E5CA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-[#2A4D3E]">
                    <strong className="text-[#073D2B] block">
                      {selectedDataset.id === 'nasa-power'
                        ? 'Live Numeric API Sync'
                        : selectedDataset.id === 'modis'
                        ? 'Live ORNL DAAC 250m Pixel + CMR Sync'
                        : 'Live Earthdata CMR Granule Discovery'}
                    </strong>
                    <span>
                      Target parcel: {farmName || farmId}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={syncingId !== null}
                    onClick={() => handleSyncDataset(selectedDataset.id)}
                    className="min-h-[42px] px-4 py-2 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-xs font-bold inline-flex items-center justify-center gap-2 transition-all disabled:opacity-50 shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-[#76B93F] ${syncingId === selectedDataset.id ? 'animate-spin' : ''}`} />
                    <span>
                      {syncingId === selectedDataset.id
                        ? 'Syncing...'
                        : selectedDataset.id === 'nasa-power'
                        ? 'Sync Live NASA POWER'
                        : selectedDataset.id === 'modis'
                        ? 'Sync Live MODIS 250m'
                        : `Discover ${selectedDataset.code} Granules`}
                    </span>
                  </button>
                </div>
              )}

              {syncNotice && (
                <div
                  className={`p-3 rounded-xl text-xs border flex items-center gap-2 ${
                    syncNotice.type === 'success'
                      ? 'bg-[#EAF5DF] border-[#76B93F] text-[#073D2B]'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{syncNotice.message}</span>
                </div>
              )}

              {recentJobs.length > 0 && (
                <div className="p-3.5 bg-white rounded-xl border border-[#E2E8DE] space-y-2">
                  <span className="text-[10px] font-bold uppercase text-[#527367] block">
                    Recent Persisted Ingestion Jobs ({farmName || farmId})
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {recentJobs.slice(0, 5).map((job: any) => (
                      <div key={job.id} className="flex flex-wrap items-center justify-between gap-2 text-[11px] py-1 border-b border-[#F0F5EE] last:border-b-0">
                        <span className="font-mono font-bold text-[#073D2B]">{job.dataset_id}</span>
                        <span className="text-[#527367]">{job.records_saved || 0} saved &bull; {job.status}</span>
                        <span className="text-[10px] text-[#8C9E94]">
                          {job.completed_at ? new Date(job.completed_at).toLocaleString() : new Date(job.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* TAB 2: DATA HARMONIZATION PIPELINE */}
      {activeTab === 'harmonization' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-[#FAFDF8] border border-[#D5E5CA] space-y-4">
            <h4 className="font-bold text-base text-[#073D2B]">Multi-Sensor Data Fusion Architecture</h4>
            <p className="text-xs text-[#527367] leading-relaxed">
              Combining 9km microwave radiometry with 250m optical NDVI and 30m digital elevation models requires strict
              geospatial harmonization standards to prevent false precision.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
              <div className="p-4 bg-white rounded-2xl border border-[#E2E8DE] space-y-1.5">
                <span className="font-bold text-[#073D2B] block">1. Spatial Grid Resampling</span>
                <p className="text-[#527367]">
                  SMAP (9km) and GPM (10km) regional grids are clipped to agricultural boundary centroids. Bilinear interpolation
                  is applied with explicit boundary weighting, displaying pixel footprints to the user.
                </p>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-[#E2E8DE] space-y-1.5">
                <span className="font-bold text-[#073D2B] block">2. Coordinate Reference System (CRS)</span>
                <p className="text-[#527367]">
                  All NASA HDF5/NetCDF files in native geographic coordinates (EPSG:4326) are reprojected on ingestion
                  to Universal Transverse Mercator (UTM) and Web Mercator (EPSG:3857) for distortion-free acreage measurements.
                </p>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-[#E2E8DE] space-y-1.5">
                <span className="font-bold text-[#073D2B] block">3. Temporal Cadence Alignment</span>
                <p className="text-[#527367]">
                  Hourly NASA POWER fluxes and 3-hour SMAP states are rolled into 7-day and 30-day moving windows
                  to match MODIS 16-day compositing intervals, minimizing short-term noise.
                </p>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-[#E2E8DE] space-y-1.5">
                <span className="font-bold text-[#073D2B] block">4. Provenance Segregation</span>
                <p className="text-[#527367]">
                  Satellite-derived estimates are strictly tagged separately from in-situ soil core tests and farmer-entered records.
                  Missing observations trigger cloud-gap flags rather than synthetic fabrication.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SCIENTIFIC METHODS & FORMULAS */}
      {activeTab === 'methods' && (
        <div className="space-y-4">
          <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2">
            <span><strong>Scientific Integrity Statement:</strong> Statistical association never proves causation. All formulas utilize standard SI units.</span>
            <span className="font-bold text-emerald-800">Peer-Reviewed Models</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scientificMethods.map((m: any, idx: number) => (
              <div key={idx} className="p-4 sm:p-5 rounded-2xl bg-[#FAFDF8] border border-[#D5E5CA] space-y-2 min-w-0">
                <h5 className="font-bold text-xs text-[#073D2B]">{m.title}</h5>
                <div className="p-2.5 bg-white rounded-xl border border-[#E2E8DE] font-mono text-[11px] text-[#145C3D] overflow-x-auto break-words">
                  {m.formula}
                </div>
                <div className="text-[11px] text-[#527367]">
                  <strong>Units:</strong> {m.units}
                </div>
                <p className="text-xs text-[#2A4D3E] pt-1">{m.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
