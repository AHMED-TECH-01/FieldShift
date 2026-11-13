import React, { useState } from 'react';
import { Sparkles, CloudRain, Sun, Calendar, Droplets, RotateCcw, AlertTriangle, ArrowRight } from 'lucide-react';
import { WhatIfScenario } from '../../types';

interface WhatIfSimulatorProps {
  onSimulate: (scenario: WhatIfScenario) => void;
  onReset: () => void;
  activeScenario?: WhatIfScenario | null;
  recalculating?: boolean;
}

export const WhatIfSimulator: React.FC<WhatIfSimulatorProps> = ({
  onSimulate,
  onReset,
  activeScenario,
  recalculating,
}) => {
  const [rainfallChange, setRainfallChange] = useState<number>(activeScenario ? activeScenario.rainfallChangePercent : -25);
  const [tempChange, setTempChange] = useState<number>(activeScenario ? activeScenario.temperatureChangeCelsius : 2);
  const [dryWeeks, setDryWeeks] = useState<number>(activeScenario ? activeScenario.extendedDrySeasonWeeks : 3);
  const [irrigationRestricted, setIrrigationRestricted] = useState<boolean>(activeScenario ? activeScenario.irrigationRestricted : true);
  const [plantingOffset, setPlantingOffset] = useState<number>(activeScenario ? activeScenario.plantingDateOffsetDays : 10);

  const handleApply = () => {
    onSimulate({
      rainfallChangePercent: rainfallChange,
      temperatureChangeCelsius: tempChange,
      extendedDrySeasonWeeks: dryWeeks,
      irrigationRestricted,
      plantingDateOffsetDays: plantingOffset,
    });
  };

  const handlePresetScenario = (name: 'drought' | 'excessive_rain' | 'early_frost') => {
    if (name === 'drought') {
      setRainfallChange(-35);
      setTempChange(3.5);
      setDryWeeks(4);
      setIrrigationRestricted(true);
      setPlantingOffset(7);
      onSimulate({
        rainfallChangePercent: -35,
        temperatureChangeCelsius: 3.5,
        extendedDrySeasonWeeks: 4,
        irrigationRestricted: true,
        plantingDateOffsetDays: 7,
      });
    } else if (name === 'excessive_rain') {
      setRainfallChange(30);
      setTempChange(-0.5);
      setDryWeeks(0);
      setIrrigationRestricted(false);
      setPlantingOffset(-14);
      onSimulate({
        rainfallChangePercent: 30,
        temperatureChangeCelsius: -0.5,
        extendedDrySeasonWeeks: 0,
        irrigationRestricted: false,
        plantingDateOffsetDays: -14,
      });
    } else if (name === 'early_frost') {
      setRainfallChange(0);
      setTempChange(-2.0);
      setDryWeeks(1);
      setIrrigationRestricted(false);
      setPlantingOffset(-10);
      onSimulate({
        rainfallChangePercent: 0,
        temperatureChangeCelsius: -2.0,
        extendedDrySeasonWeeks: 1,
        irrigationRestricted: false,
        plantingDateOffsetDays: -10,
      });
    }
  };

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-8 border border-[#D5E5CA] shadow-sm space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E2E8DE] pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-900 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Requirement H: What-If Scenario Simulator</span>
          </div>
          <h3 className="font-display text-fluid-h2 font-bold text-[#073D2B]">
            Interactive Climate Stress & Management Analysis
          </h3>
          <p className="text-xs text-[#527367] mt-1 max-w-2xl">
            Test how hypothetical environmental anomalies impact your crop suitability, water budgets,
            and strategy rankings before committing seed and fertilizer capital.
          </p>
        </div>

        {/* Clear Simulation Notice */}
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 lg:max-w-xs text-[11px] text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Hypothetical Simulation:</strong> These values represent simulated test conditions, NOT actual real-time NASA observations or seasonal forecasts.
          </span>
        </div>
      </div>

      {/* Preset Scenarios Buttons */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <span className="text-xs font-bold text-[#527367] w-full sm:w-auto">Benchmark Scenarios:</span>
        <button
          type="button"
          onClick={() => handlePresetScenario('drought')}
          className="min-h-[40px] px-3.5 py-2 rounded-full bg-[#FAFDF8] border border-[#CDE5BA] hover:bg-[#EAF5DF] text-xs font-semibold text-[#145C3D] text-left"
        >
          2012-Style Severe Summer Drought (-35% Rain, +3.5°C)
        </button>
        <button
          type="button"
          onClick={() => handlePresetScenario('excessive_rain')}
          className="min-h-[40px] px-3.5 py-2 rounded-full bg-[#FAFDF8] border border-[#CDE5BA] hover:bg-[#EAF5DF] text-xs font-semibold text-[#145C3D] text-left"
        >
          Late Wet Spring (+30% Rain, Delayed Planting)
        </button>
        <button
          type="button"
          onClick={() => handlePresetScenario('early_frost')}
          className="min-h-[40px] px-3.5 py-2 rounded-full bg-[#FAFDF8] border border-[#CDE5BA] hover:bg-[#EAF5DF] text-xs font-semibold text-[#145C3D] text-left"
        >
          Early Autumn Freeze (-2.0°C Mean)
        </button>
      </div>

      {/* Interactive Sliders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
        
        {/* 1. Rainfall Anomaly */}
        <div className="p-4 rounded-2xl bg-[#FAFDF8] border border-[#E2E8DE] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#073D2B] flex items-center gap-1.5">
              <CloudRain className="w-4 h-4 text-blue-600" />
              Precipitation Anomaly
            </span>
            <span className="font-display font-bold text-xs text-[#073D2B] bg-white px-2 py-0.5 rounded border border-[#E2E8DE]">
              {rainfallChange > 0 ? `+${rainfallChange}%` : `${rainfallChange}%`}
            </span>
          </div>
          <input
            type="range"
            min={-40}
            max={40}
            step={5}
            value={rainfallChange}
            onChange={(e) => setRainfallChange(Number(e.target.value))}
            className="w-full accent-[#073D2B] cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[#8C9E94]">
            <span>-40% Extreme Drought</span>
            <span>0% Normal</span>
            <span>+40% Flood Risk</span>
          </div>
        </div>

        {/* 2. Temperature Anomaly */}
        <div className="p-4 rounded-2xl bg-[#FAFDF8] border border-[#E2E8DE] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#073D2B] flex items-center gap-1.5">
              <Sun className="w-4 h-4 text-amber-600" />
              Temperature Deviation
            </span>
            <span className="font-display font-bold text-xs text-[#073D2B] bg-white px-2 py-0.5 rounded border border-[#E2E8DE]">
              {tempChange > 0 ? `+${tempChange}°C` : `${tempChange}°C`}
            </span>
          </div>
          <input
            type="range"
            min={-2}
            max={5}
            step={0.5}
            value={tempChange}
            onChange={(e) => setTempChange(Number(e.target.value))}
            className="w-full accent-[#073D2B] cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[#8C9E94]">
            <span>-2.0°C Cool Spell</span>
            <span>Baseline</span>
            <span>+5.0°C Extreme Heatwave</span>
          </div>
        </div>

        {/* 3. Extended Dry Weeks */}
        <div className="p-4 rounded-2xl bg-[#FAFDF8] border border-[#E2E8DE] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#073D2B] flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-600" />
              Mid-Summer Dry Period
            </span>
            <span className="font-display font-bold text-xs text-[#073D2B] bg-white px-2 py-0.5 rounded border border-[#E2E8DE]">
              +{dryWeeks} Weeks Duration
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={6}
            step={1}
            value={dryWeeks}
            onChange={(e) => setDryWeeks(Number(e.target.value))}
            className="w-full accent-[#073D2B] cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[#8C9E94]">
            <span>0 (Normal rain intervals)</span>
            <span>+6 Weeks Prolonged Deficit</span>
          </div>
        </div>

        {/* 4. Planting Window Shift */}
        <div className="p-4 rounded-2xl bg-[#FAFDF8] border border-[#E2E8DE] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#073D2B] flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-purple-600" />
              Planting Date Offset
            </span>
            <span className="font-display font-bold text-xs text-[#073D2B] bg-white px-2 py-0.5 rounded border border-[#E2E8DE]">
              {plantingOffset > 0 ? `+${plantingOffset} Days (Delayed)` : `${plantingOffset} Days (Early)`}
            </span>
          </div>
          <input
            type="range"
            min={-21}
            max={21}
            step={7}
            value={plantingOffset}
            onChange={(e) => setPlantingOffset(Number(e.target.value))}
            className="w-full accent-[#073D2B] cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[#8C9E94]">
            <span>-21 Days Early</span>
            <span>Target Window</span>
            <span>+21 Days Late Wet Ground</span>
          </div>
        </div>

        {/* 5. Irrigation Restriction */}
        <div className="p-4 rounded-2xl bg-[#FAFDF8] border border-[#E2E8DE] space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#073D2B] flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-sky-600" />
              Water Scarcity / Pumping Limit
            </span>
            <span className="text-xs font-bold text-[#145C3D]">
              {irrigationRestricted ? 'Restricted' : 'Full Available'}
            </span>
          </div>
          <label className="flex items-center gap-2.5 min-h-[44px] cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={irrigationRestricted}
              onChange={(e) => setIrrigationRestricted(e.target.checked)}
              className="w-5 h-5 text-[#073D2B] focus:ring-[#76B93F] rounded shrink-0"
            />
            <span className="text-xs text-[#527367]">Simulate dryland-only operation (no supplemental pivot)</span>
          </label>
        </div>

      </div>

      {/* Action Footer */}
      <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            setRainfallChange(0);
            setTempChange(0);
            setDryWeeks(0);
            setIrrigationRestricted(false);
            setPlantingOffset(0);
            onReset();
          }}
          className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full border border-[#D5E5CA] hover:bg-[#F0F5EE] text-xs font-bold text-[#527367]"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset to Current NASA Baseline</span>
        </button>

        <button
          type="button"
          disabled={recalculating}
          onClick={handleApply}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all"
        >
          <span>Run Scenario Recalculation</span>
          <ArrowRight className="w-4 h-4 text-[#76B93F]" />
        </button>
      </div>

    </div>
  );
};
