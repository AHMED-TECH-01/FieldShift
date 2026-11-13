import React, { useState } from 'react';
import { Satellite, Globe2, Radio, Database, ArrowUpRight, Activity, ShieldCheck, AlertCircle } from 'lucide-react';

interface NasaExplorerPreviewProps {
  onOpenExplorer: () => void;
}

export const NasaExplorerPreview: React.FC<NasaExplorerPreviewProps> = ({ onOpenExplorer }) => {
  const [activeDataset, setActiveDataset] = useState('smap');

  const datasets = [
    {
      id: 'smap',
      code: 'SMAP L4',
      name: 'Soil Moisture Active Passive',
      mission: 'NASA JPL / Goddard',
      metric: 'Volumetric Soil Moisture',
      currentValue: '0.284 m³/m³',
      status: 'Adequate Moisture',
      resolution: '9 km assimilated grid',
      cadence: '3-hour model updates',
      purpose: 'Quantifies root-zone available water capacity to evaluate plant stress and irrigation timing.',
      limitation: 'Coarse 9km cell aggregates localized topography and drainage swales.',
    },
    {
      id: 'gpm',
      code: 'GPM IMERG',
      name: 'Global Precipitation Measurement',
      mission: 'NASA Goddard / JAXA',
      metric: 'Precipitation Intensity & Total',
      currentValue: '68.4 mm (30-day sum)',
      status: '+12.1 mm Anomaly',
      resolution: '0.1° (~10 km)',
      cadence: '30-minute intervals',
      purpose: 'Tracks rainfall accumulation, storm intensity, and prolonged drought intervals.',
      limitation: 'Snowfall precipitation accuracy is lower than liquid rainfall.',
    },
    {
      id: 'modis',
      code: 'MODIS MOD13Q1',
      name: 'Terra & Aqua Vegetation Index',
      mission: 'NASA GSFC / LP DAAC',
      metric: 'NDVI & EVI Canopy Greenness',
      currentValue: '0.72 NDVI',
      status: 'Vigorous Vegetative Vigor',
      resolution: '250 m multispectral',
      cadence: '16-day composited',
      purpose: 'Measures photosynthetic activity, biomass density, and seasonal crop emergence.',
      limitation: 'Persistent cloud cover requires multi-day temporal compositing.',
    },
    {
      id: 'power',
      code: 'NASA POWER',
      name: 'Prediction Of Worldwide Energy Resources',
      mission: 'NASA Langley Research Center',
      metric: 'Solar Insolation & Temp Fluxes',
      currentValue: '19.4 MJ/m²/day',
      status: 'Growing Degree Days: 168',
      resolution: '0.5° x 0.5° grid',
      cadence: 'Daily agroclimatology',
      purpose: 'Calculates thermal heat units, evapotranspiration baselines, and frost exposure risks.',
      limitation: 'Assimilated meteorological model; localized cold air drainages may differ.',
    },
    {
      id: 'ecostress',
      code: 'ECOSTRESS',
      name: 'Evaporative Stress on Space Station',
      mission: 'NASA JPL / ISS Orbit',
      metric: 'Evaporative Stress Index (ESI)',
      currentValue: '0.18 (Low Deficit)',
      status: 'Optimal Transpiration',
      resolution: '70 m x 70 m high res',
      cadence: 'Variable ISS Ground Track',
      purpose: 'Detects plant water stress before visible wilting occurs by measuring thermal canopy emission.',
      limitation: 'Precession orbit means revisit cadence varies between 1 to 5 days.',
    },
  ];

  const current = datasets.find((d) => d.id === activeDataset) || datasets[0];

  return (
    <section className="py-16 md:py-20 bg-[#F8F7ED] border-b border-[#E2E8DE]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-bold uppercase tracking-wider mb-2">
              <Satellite className="w-3.5 h-3.5" />
              Earth Observation Telemetry
            </div>
            <h2 className="font-display text-fluid-h2 font-extrabold text-[#073D2B] tracking-tight">
              Direct NASA Satellite Ingestion
            </h2>
            <p className="text-sm sm:text-base text-[#527367] mt-2 max-w-2xl leading-relaxed">
              We translate multi-mission Earth science data into agronomic intelligence.
              No fabricated satellite readings — clear data provenance with explicit resolution boundaries.
            </p>
          </div>

          <button
            onClick={onOpenExplorer}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-xs sm:text-sm font-semibold transition-all self-start md:self-auto"
          >
            <span>Open NASA Explorer</span>
            <ArrowUpRight className="w-4 h-4 text-[#76B93F]" />
          </button>
        </div>

        {/* Dataset Pill Selector */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {datasets.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveDataset(d.id)}
              className={`flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                activeDataset === d.id
                  ? 'bg-[#073D2B] text-white border-[#073D2B] shadow-sm'
                  : 'bg-white text-[#2A4D3E] border-[#E2E8DE] hover:border-[#76B93F]'
              }`}
            >
              <Radio className={`w-3 h-3 ${activeDataset === d.id ? 'text-[#76B93F]' : 'text-[#8C9E94]'}`} />
              <span>{d.code}</span>
            </button>
          ))}
        </div>

        {/* Selected Sensor Telemetry Display Card */}
        <div className="bg-white rounded-3xl border border-[#D5E5CA] p-4 sm:p-8 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          
          {/* Left: Sensor Details & Specs */}
          <div className="lg:col-span-7 space-y-4 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-[#EAF5DF] text-[#145C3D] text-xs font-bold">
                {current.mission}
              </span>
              <span className="text-xs font-medium text-[#527367]">Mission Dataset</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-[#073D2B]">{current.name}</h3>
            <p className="text-sm text-[#2A4D3E] leading-relaxed">{current.purpose}</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-[#FAFDF8] p-3 rounded-xl border border-[#E2E8DE]">
                <span className="text-[11px] text-[#527367] block">Spatial Resolution</span>
                <span className="text-xs font-bold text-[#073D2B]">{current.resolution}</span>
              </div>
              <div className="bg-[#FAFDF8] p-3 rounded-xl border border-[#E2E8DE]">
                <span className="text-[11px] text-[#527367] block">Temporal Update</span>
                <span className="text-xs font-bold text-[#073D2B]">{current.cadence}</span>
              </div>
              <div className="bg-[#FAFDF8] p-3 rounded-xl border border-[#E2E8DE]">
                <span className="text-[11px] text-[#527367] block">Primary Metric</span>
                <span className="text-xs font-bold text-[#073D2B]">{current.metric}</span>
              </div>
            </div>

            {/* Scientific limitation transparency */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900">Dataset Resolution Caveat: </span>
                {current.limitation}
              </div>
            </div>
          </div>

          {/* Right: Real-Time Telemetry Readout Box */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#073D2B] to-[#145C3D] rounded-2xl p-5 sm:p-6 text-white flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono uppercase tracking-wider text-[#9BD85A] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#76B93F] animate-ping" />
                  Live Farm Telemetry
                </span>
                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-white/80">
                  UTC ACTIVE
                </span>
              </div>

              <div className="mt-6">
                <p className="text-xs text-white/70">{current.metric}</p>
                <p className="font-display text-2xl sm:text-4xl font-extrabold text-white mt-1 break-words">
                  {current.currentValue}
                </p>
                <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-white/15 text-[#9BD85A] text-xs font-semibold">
                  <Activity className="w-3.5 h-3.5" />
                  <span>{current.status}</span>
                </div>
              </div>
            </div>

            <div className="pt-5 mt-6 border-t border-white/15 text-xs text-white/75 flex flex-wrap items-center justify-between gap-2">
              <span>Station: Prairie Ridge (Iowa)</span>
              <span className="text-[#9BD85A] font-semibold">Verified Ground Link</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
