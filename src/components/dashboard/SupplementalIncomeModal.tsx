import React, { useState, useEffect } from 'react';
import { DollarSign, AlertCircle, ArrowUpRight, CheckCircle2, ShieldAlert, Sparkles, X } from 'lucide-react';
import { SupplementalIncome } from '../../types';
import { apiClient } from '../../services/apiClient';

interface SupplementalIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupplementalIncomeModal: React.FC<SupplementalIncomeModalProps> = ({ isOpen, onClose }) => {
  const [opportunities, setOpportunities] = useState<SupplementalIncome[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchIncomeData();
    }
  }, [isOpen]);

  const fetchIncomeData = async () => {
    try {
      const data = await apiClient.get('/api/analysis/supplemental-income');
      if (data.opportunities) {
        setOpportunities(data.opportunities);
      }
    } catch (e) {
      console.error('Failed to load income opportunities', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fs-fade overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-3xl w-full shadow-2xl border border-[#D5E5CA] max-h-[92dvh] overflow-y-auto my-auto p-5 sm:p-8 space-y-6">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#E2E8DE] pb-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF5DF] text-[#145C3D] text-[11px] sm:text-xs font-bold uppercase tracking-wider mb-1.5">
              <DollarSign className="w-3.5 h-3.5 shrink-0" />
              <span>Requirement E: Supplemental Agricultural Income</span>
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-bold text-[#073D2B]">
              Diversified Revenue Streams & Conservation Incentives
            </h3>
            <p className="text-xs text-[#527367] mt-1 max-w-xl">
              Identifies economic avenues beyond single-commodity grain sales, including forage grazing leases,
              USDA-NRCS conservation stewardship payments, and specialty pulse contracts.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full hover:bg-[#F0F5EE] text-[#073D2B]"
            aria-label="Close Supplemental Income Explorer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Missing Market Data Disclaimer */}
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Mandatory Economic Ethics Guardrail:</strong> Field Shift does NOT fabricate income projections.
            Local commodity basis bids, custom grazing agreements, and conservation contract allocations vary by county and are explicitly listed where missing.
          </div>
        </div>

        {/* Opportunity Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {opportunities.map((opp, idx) => (
            <div
              key={idx}
              className="p-4 sm:p-5 rounded-2xl bg-[#FAFDF8] border border-[#D5E5CA] space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                  <span className="text-[10px] font-bold text-[#145C3D] bg-[#EAF5DF] px-2 py-0.5 rounded">
                    {opp.category}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      opp.feasibility === 'High'
                        ? 'bg-emerald-100 text-emerald-800'
                        : opp.feasibility === 'Moderate'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {opp.feasibility} Feasibility
                  </span>
                </div>

                <h4 className="font-bold text-sm text-[#073D2B] mt-2">{opp.opportunityName}</h4>
                <div className="text-lg font-display font-extrabold text-[#073D2B] my-1">
                  {opp.estimatedGrossValuePerAcre}
                </div>
                <p className="text-xs text-[#527367] leading-relaxed">
                  <strong>Prerequisite:</strong> {opp.localMarketRequirement}
                </p>
              </div>

              <div className="pt-3 border-t border-[#E2E8DE] text-[11px] text-amber-900 bg-amber-50/70 p-2.5 rounded-xl">
                <strong>Data Gap / Notice:</strong> {opp.missingDataNotice}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <span className="text-xs text-[#527367]">
            Source: Iowa State Ag Decision Maker & USDA NRCS Cost-Share Schedules.
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 min-h-[44px] rounded-full bg-[#073D2B] text-white text-xs font-bold hover:bg-[#145C3D]"
          >
            Close Income Explorer
          </button>
        </div>

      </div>
    </div>
  );
};
