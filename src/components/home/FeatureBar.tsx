import React from 'react';
import { Satellite, Sprout, RefreshCw, BarChart3, Bot, ChevronRight } from 'lucide-react';

interface FeatureBarProps {
  onSelectFeature: (featureId: string) => void;
  activeFeature?: string;
}

export const FeatureBar: React.FC<FeatureBarProps> = ({ onSelectFeature, activeFeature }) => {
  const features = [
    {
      id: 'nasa',
      title: 'NASA Earth Observations',
      subtitle: 'SMAP, GPM & MODIS Satellites',
      icon: Satellite,
      color: 'text-sky-600',
      bgColor: 'bg-sky-50',
      hoverBorder: 'hover:border-sky-300',
    },
    {
      id: 'soil',
      title: 'Soil Intelligence',
      subtitle: 'pH, Organic Matter & N-P-K',
      icon: Sprout,
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
      hoverBorder: 'hover:border-emerald-300',
    },
    {
      id: 'rotation',
      title: 'Crop Rotation Engine',
      subtitle: 'Multi-Year Strategy Simulation',
      icon: RefreshCw,
      color: 'text-amber-700',
      bgColor: 'bg-amber-50',
      hoverBorder: 'hover:border-amber-300',
    },
    {
      id: 'risk',
      title: 'Field Risk Analysis',
      subtitle: 'Drought, Heat & Erosion Indices',
      icon: BarChart3,
      color: 'text-rose-700',
      bgColor: 'bg-rose-50',
      hoverBorder: 'hover:border-rose-300',
    },
    {
      id: 'ai-advisor',
      title: 'AI Agricultural Advisor',
      subtitle: 'Gemini Science Agronomic Copilot',
      icon: Bot,
      color: 'text-[#145C3D]',
      bgColor: 'bg-[#EAF5DF]',
      hoverBorder: 'hover:border-[#76B93F]',
    },
  ];

  return (
    <section className="relative z-20 -mt-6 sm:-mt-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="bg-white/95 backdrop-blur-xl border border-[#D0E2C8] rounded-3xl p-2.5 sm:p-4 shadow-xl shadow-[#073D2B]/5">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          {features.map((feat) => {
            const Icon = feat.icon;
            const isActive = activeFeature === feat.id;
            return (
              <button
                key={feat.id}
                onClick={() => onSelectFeature(feat.id)}
                className={`flex items-center gap-3 min-h-[56px] p-2.5 sm:p-3 rounded-2xl text-left transition-all group border ${
                  isActive
                    ? 'bg-[#F2F8ED] border-[#76B93F] shadow-sm ring-2 ring-[#76B93F]/20'
                    : `bg-white/60 hover:bg-[#F8FBF6] border-transparent ${feat.hoverBorder}`
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl ${feat.bgColor} ${feat.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-bold text-[#073D2B] leading-snug group-hover:text-[#145C3D]">
                    {feat.title}
                  </h3>
                  <p className="text-[11px] text-[#527367] leading-snug mt-0.5">
                    {feat.subtitle}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#BAC9BE] group-hover:text-[#073D2B] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
