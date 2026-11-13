import React, { useState } from 'react';
import { X, Play, Pause, RotateCcw, CheckCircle2, Satellite, Sprout, RefreshCw, Bot, ArrowRight } from 'lucide-react';

interface DemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExplore: () => void;
}

export const DemoModal: React.FC<DemoModalProps> = ({ isOpen, onClose, onExplore }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  if (!isOpen) return null;

  const steps = [
    {
      title: 'Step 1: Automated Satellite Telemetry Fetch',
      description: 'Field Shift queries NASA SMAP, GPM, and MODIS for the exact geospatial boundaries of your parcel.',
      metric: 'NASA SMAP: 0.284 m³/m³ (Optimal) | GPM 30-Day: 68.4mm',
      icon: Satellite,
      badge: 'NASA SATELLITE PASS',
    },
    {
      title: 'Step 2: Local Soil Chemistry Cross-Referencing',
      description: 'Measured laboratory pH (6.4) and Organic Matter (3.8%) calibrate the soil water-holding capacity equation.',
      metric: 'Available Water Capacity: +22,000 gal/acre buffer',
      icon: Sprout,
      badge: 'SOIL INTELLIGENCE',
    },
    {
      title: 'Step 3: Multi-Year Rotation Simulation',
      description: 'The engine tests Strategy A (Current), Strategy B (Soil Restoration), and Strategy C (Climate Resilient).',
      metric: 'Strategy B delivers +86% resilience with 85 lbs/acre fixed nitrogen',
      icon: RefreshCw,
      badge: 'ROTATION ENGINE',
    },
    {
      title: 'Step 4: AI Agricultural Advisor Synthesis',
      description: 'Gemini 3.8 Flash synthesizes agronomic trade-offs and highlights herbicide timing and seed-bed preparation.',
      metric: 'Custom Farmer Guidance: Low weed seed bank, high biological activity',
      icon: Bot,
      badge: 'GEMINI COPILOT',
    },
  ];

  const current = steps[activeStep];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fs-fade overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full shadow-2xl border border-[#D5E5CA] overflow-y-auto max-h-[92dvh] my-auto flex flex-col">
        
        {/* Modal Top Bar */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-[#073D2B] text-white flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-[#76B93F] animate-ping shrink-0" />
            <span className="font-display font-bold text-xs sm:text-sm tracking-wide truncate">
              FIELD SHIFT INTERACTIVE PLATFORM DEMO
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            aria-label="Close demo modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Simulation Canvas Screen */}
        <div className="relative bg-gradient-to-br from-[#0c2e22] via-[#073D2B] to-[#145C3D] p-5 sm:p-8 text-white flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="px-3 py-1 rounded-full bg-white/15 text-[#9BD85A] text-[11px] sm:text-xs font-mono font-bold tracking-wider">
              {current.badge}
            </span>
            <span className="text-xs font-mono text-white/70">
              STEP {activeStep + 1} OF {steps.length}
            </span>
          </div>

          <div className="my-5 sm:my-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-[#76B93F]">
                <Icon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-lg sm:text-2xl font-bold leading-snug">{current.title}</h3>
                <p className="text-xs sm:text-sm text-white/80 mt-1 max-w-lg leading-relaxed">{current.description}</p>
              </div>
            </div>

            <div className="mt-4 sm:mt-5 p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 font-mono text-[11px] sm:text-xs text-[#9BD85A] flex items-start sm:items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#76B93F] shrink-0 mt-1 sm:mt-0" />
              <span className="break-words">{current.metric}</span>
            </div>
          </div>

          {/* Step Progress Dots */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/15">
            <div className="flex items-center gap-1.5">
              {steps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveStep(idx)}
                  aria-label={`Go to step ${idx + 1}`}
                  className="py-3 px-0.5 flex items-center justify-center"
                >
                  <span
                    className={`block h-2 rounded-full transition-all ${
                      idx === activeStep ? 'w-7 bg-[#76B93F]' : 'w-2.5 bg-white/30 hover:bg-white/50'
                    }`}
                  />
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveStep((prev) => (prev > 0 ? prev - 1 : steps.length - 1))}
                className="px-3.5 py-2 min-h-[44px] text-xs font-semibold bg-white/10 hover:bg-white/20 rounded-xl text-white"
              >
                Previous
              </button>
              <button
                onClick={() => setActiveStep((prev) => (prev < steps.length - 1 ? prev + 1 : 0))}
                className="px-3.5 py-2 min-h-[44px] text-xs font-semibold bg-[#76B93F] hover:bg-[#9BD85A] text-[#073D2B] rounded-xl"
              >
                Next Step
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 bg-[#FAFDF8] border-t border-[#E2E8DE] flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-[#527367] hover:text-[#073D2B] px-4 py-2 min-h-[44px] rounded-full hover:bg-[#E7EFE6] transition-colors"
          >
            Close Demo
          </button>

          <button
            onClick={() => {
              onClose();
              onExplore();
            }}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 min-h-[44px] rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-xs sm:text-sm font-semibold transition-all shadow-sm"
          >
            <span>Launch Live Dashboard</span>
            <ArrowRight className="w-4 h-4 text-[#76B93F]" />
          </button>
        </div>

      </div>
    </div>
  );
};
