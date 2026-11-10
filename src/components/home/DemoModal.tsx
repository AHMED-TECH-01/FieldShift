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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-[#D5E5CA] overflow-hidden flex flex-col">
        
        {/* Modal Top Bar */}
        <div className="px-6 py-4 bg-[#073D2B] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#76B93F] animate-ping" />
            <span className="font-display font-bold text-sm tracking-wide">
              FIELD SHIFT INTERACTIVE PLATFORM DEMO
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Simulation Canvas Screen */}
        <div className="relative bg-gradient-to-br from-[#0c2e22] via-[#073D2B] to-[#145C3D] p-8 text-white min-h-[260px] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 rounded-full bg-white/15 text-[#9BD85A] text-xs font-mono font-bold tracking-wider">
              {current.badge}
            </span>
            <span className="text-xs font-mono text-white/70">
              STEP {activeStep + 1} OF {steps.length}
            </span>
          </div>

          <div className="my-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-[#76B93F]">
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display text-xl sm:text-2xl font-bold">{current.title}</h3>
                <p className="text-xs sm:text-sm text-white/80 mt-1 max-w-lg">{current.description}</p>
              </div>
            </div>

            <div className="mt-5 p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 font-mono text-xs text-[#9BD85A] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#76B93F]" />
              <span>{current.metric}</span>
            </div>
          </div>

          {/* Step Progress Dots */}
          <div className="flex items-center justify-between pt-4 border-t border-white/15">
            <div className="flex items-center gap-2">
              {steps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveStep(idx)}
                  className={`h-2 rounded-full transition-all ${
                    idx === activeStep ? 'w-8 bg-[#76B93F]' : 'w-2 bg-white/30 hover:bg-white/50'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveStep((prev) => (prev > 0 ? prev - 1 : steps.length - 1))}
                className="px-3 py-1 text-xs font-semibold bg-white/10 hover:bg-white/20 rounded-lg text-white"
              >
                Previous
              </button>
              <button
                onClick={() => setActiveStep((prev) => (prev < steps.length - 1 ? prev + 1 : 0))}
                className="px-3 py-1 text-xs font-semibold bg-[#76B93F] hover:bg-[#9BD85A] text-[#073D2B] rounded-lg"
              >
                Next Step
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-5 bg-[#FAFDF8] border-t border-[#E2E8DE] flex items-center justify-between">
          <button
            onClick={() => {
              onClose();
              onExplore();
            }}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-xs sm:text-sm font-semibold transition-all shadow-sm"
          >
            <span>Launch Live Dashboard</span>
            <ArrowRight className="w-4 h-4 text-[#76B93F]" />
          </button>

          <button
            onClick={onClose}
            className="text-xs font-semibold text-[#527367] hover:text-[#073D2B] px-3 py-1.5"
          >
            Close Demo
          </button>
        </div>

      </div>
    </div>
  );
};
