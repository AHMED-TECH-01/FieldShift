import React, { useState, useEffect } from 'react';
import { Satellite, Database, ShieldCheck, Activity, AlertCircle, Compass, Layers, CheckCircle2, BookOpen } from 'lucide-react';
import { NasaHarmonizedDataset } from '../../types';

export const NasaRoadmapExplorer: React.FC = () => {
  const [datasets, setDatasets] = useState<NasaHarmonizedDataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<NasaHarmonizedDataset | null>(null);
  const [scientificMethods, setScientificMethods] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'catalog' | 'harmonization' | 'methods'>('catalog');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoadmap();
    fetchMethods();
  }, []);

  const fetchRoadmap = async () => {
    try {
      const res = await fetch('/api/nasa/roadmap');
      const data = await res.json();
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
      const res = await fetch('/api/scientific-methods');
      const data = await res.json();
      if (data.methods) {
        setScientificMethods(data.methods);
      }
    } catch (e) {
      console.error('Failed to load scientific methods', e);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#D5E5CA] shadow-sm space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E2E8DE] pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF5DF] text-[#145C3D] text-xs font-bold uppercase tracking-wider mb-2">
            <Satellite className="w-3.5 h-3.5" />
            Requirements F & G: NASA Data Integration & Scientific Fusion Pipeline
          </div>
          <h3 className="font-display text-2xl font-bold text-[#073D2B]">
            Multi-Mission Earth Science Architecture
          </h3>
          <p className="text-xs text-[#527367] mt-1 max-w-2xl">
            Supported 8-mission satellite catalog, harmonization data pipeline, and peer-reviewed mathematical methodologies.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center bg-[#E7EFE6] p-1 rounded-full self-start md:self-auto">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === 'catalog' ? 'bg-white text-[#073D2B] shadow-xs' : 'text-[#527367]'
            }`}
          >
            8 NASA Datasets
          </button>
          <button
            onClick={() => setActiveTab('harmonization')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === 'harmonization' ? 'bg-white text-[#073D2B] shadow-xs' : 'text-[#527367]'
            }`}
          >
            Harmonization
          </button>
          <button
            onClick={() => setActiveTab('methods')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === 'methods' ? 'bg-white text-[#073D2B] shadow-xs' : 'text-[#527367]'
            }`}
          >
            Scientific Formulas
          </button>
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
            <div className="lg:col-span-7 bg-[#FAFDF8] rounded-3xl p-6 border border-[#D5E5CA] space-y-4">
              <div className="flex items-center justify-between border-b border-[#E2E8DE] pb-3">
                <div>
                  <span className="px-2.5 py-0.5 rounded bg-[#073D2B] text-white text-[10px] font-mono font-bold">
                    {selectedDataset.code}
                  </span>
                  <h4 className="font-bold text-lg text-[#073D2B] mt-1">{selectedDataset.name}</h4>
                  <p className="text-xs text-[#527367]">{selectedDataset.source}</p>
                </div>
                <span className="text-[10px] bg-white border border-[#E2E8DE] px-2 py-1 rounded text-[#145C3D] font-mono font-bold">
                  {selectedDataset.dataCategory}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
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
          <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs text-emerald-900 flex items-center justify-between">
            <span><strong>Scientific Integrity Statement:</strong> Statistical association never proves causation. All formulas utilize standard SI units.</span>
            <span className="font-bold text-emerald-800">Peer-Reviewed Models</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scientificMethods.map((m: any, idx: number) => (
              <div key={idx} className="p-5 rounded-2xl bg-[#FAFDF8] border border-[#D5E5CA] space-y-2">
                <h5 className="font-bold text-xs text-[#073D2B]">{m.title}</h5>
                <div className="p-2.5 bg-white rounded-xl border border-[#E2E8DE] font-mono text-[11px] text-[#145C3D]">
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
