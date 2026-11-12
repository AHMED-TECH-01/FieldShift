import React, { useState } from 'react';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';
import {
  Bot,
  Send,
  Sparkles,
  Satellite,
  Sprout,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface AiAdvisorPageProps {
  onNavigate: (path: string) => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
}

export const AiAdvisorPage: React.FC<AiAdvisorPageProps> = ({ onNavigate, onOpenAuth }) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<
    Array<{
      sender: 'user' | 'ai';
      text: string;
      source?: string;
      isFallback?: boolean;
      fallbackReason?: string;
      originalPrompt?: string;
      latencyMs?: number;
    }>
  >([
    {
      sender: 'ai',
      text: `Hello! I am your Field Shift Agronomic Advisor powered by Gemini 3.8 Flash.
I am actively grounded in verified NASA Earth observations (SMAP 9km root-zone moisture, GPM 30-min precipitation anomalies, and MODIS 250m NDVI) along with USDA-NRCS soil physics.

How can I help you compare crop sequences, calculate biological nitrogen credits, or evaluate drought vulnerabilities today?`,
      source: 'NASA Earth Observations & Soil Physics Grounding',
      isFallback: false,
    },
  ]);

  const quickPrompts = [
    'How much nitrogen can winter hairy vetch supply to succeeding corn?',
    'Explain how NASA SMAP moisture helps predict mid-summer pollination stress.',
    'What are the trade-offs of substituting corn with sorghum on dryland acreage?',
    'How does a 3-year crop sequence interrupt western corn rootworm?',
  ];

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || prompt).trim();
    if (!query || loading) return;

    const newMessages = [...messages, { sender: 'user' as const, text: query }];
    setMessages(newMessages);
    setPrompt('');
    setLoading(true);

    try {
      const data = await apiClient.post('/api/gemini/advisor', {
        prompt: query,
        farmId: 'farm-1',
        priorities: { waterConservation: 4, soilOrganicMatter: 5, nitrogenFixing: 5 },
      });
      setMessages([
        ...newMessages,
        {
          sender: 'ai',
          text: data.reply || 'Analysis completed based on current telemetry models.',
          source: data.source || 'gemini-3.8-flash',
          isFallback: !!data.isFallback,
          fallbackReason: data.fallbackReason,
          originalPrompt: query,
          latencyMs: data.latencyMs,
        },
      ]);
    } catch (e: any) {
      setMessages([
        ...newMessages,
        {
          sender: 'ai',
          text: 'Unable to connect to the advisor backend. Please ensure network connectivity.',
          isFallback: true,
          fallbackReason: 'Network connection failure',
          originalPrompt: query,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-10 md:py-16 bg-[#F8F7ED] min-h-screen text-[#102A24]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        {/* Breadcrumb Header */}
        <div>
          <Breadcrumbs
            items={[
              { label: 'Resources', path: '/resources' },
              { label: 'AI Agricultural Advisor' },
            ]}
            onNavigate={onNavigate}
          />
          <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF5DF] text-[#145C3D] text-xs font-bold uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#76B93F]" />
                Gemini 3.8 Flash Grounded Copilot
              </div>
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#073D2B]">
                AI Agricultural Advisor
              </h1>
              <p className="text-sm sm:text-base text-[#527367] mt-2 max-w-2xl leading-relaxed">
                Objective agronomic advisory grounded in your real-time NASA satellite observations,
                soil chemistry indices, and custom farmer priorities.
              </p>
            </div>
            <button
              onClick={() => onNavigate('/dashboard/ai-advisor')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#073D2B] text-white text-xs sm:text-sm font-semibold hover:bg-[#145C3D] transition-all shadow-md self-start md:self-auto"
            >
              <span>Open in Dashboard</span>
              <ArrowRight className="w-4 h-4 text-[#76B93F]" />
            </button>
          </div>
        </div>

        {/* Telemetry Grounding Indicators Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-[#D5E5CA] shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-800 flex items-center justify-center">
              <Satellite className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#527367] uppercase block">NASA SMAP Grounding</span>
              <span className="text-xs font-bold text-[#073D2B]">0.284 m³/m³ Root Moisture</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#D5E5CA] shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#145C3D] flex items-center justify-center">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#527367] uppercase block">MODIS NDVI Grounding</span>
              <span className="text-xs font-bold text-[#073D2B]">0.72 Active Photosynthesis</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#D5E5CA] shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#527367] uppercase block">Agronomic Code</span>
              <span className="text-xs font-bold text-[#073D2B]">Zero Corporate Bias</span>
            </div>
          </div>
        </div>

        {/* Interactive Chat Console */}
        <div className="bg-white rounded-3xl border border-[#D5E5CA] shadow-sm overflow-hidden flex flex-col h-[520px]">
          
          {/* Messages Window */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-[#FAFDF8]/50">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-3 max-w-[85%] ${
                  m.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    m.sender === 'user'
                      ? 'bg-[#073D2B] text-white'
                      : 'bg-[#EAF5DF] text-[#145C3D]'
                  }`}
                >
                  {m.sender === 'user' ? 'You' : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                    m.sender === 'user'
                      ? 'bg-[#073D2B] text-white rounded-tr-xs'
                      : m.isFallback
                      ? 'bg-[#FCFDF9] text-[#102A24] border border-amber-300 rounded-tl-xs shadow-2xs'
                      : 'bg-white border border-[#D5E5CA] text-[#102A24] rounded-tl-xs shadow-2xs'
                  }`}
                >
                  {m.text}

                  {/* Distinct Honest Source & Retry Controls */}
                  {m.sender === 'ai' && (
                    <div className="mt-3 pt-2.5 border-t border-[#E2E8DE] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      {m.isFallback ? (
                        <div className="flex items-center gap-1.5 text-amber-900 font-medium bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Agronomic Fallback Engine • Gemini Offline ({m.fallbackReason || 'Temporarily Unavailable'})</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[#145C3D] font-medium bg-[#EAF5DF] px-2.5 py-1 rounded-lg border border-[#C2E0B0]">
                          <Sparkles className="w-3.5 h-3.5 text-[#76B93F] shrink-0" />
                          <span>Gemini 3.8 Flash • NASA Grounded {m.latencyMs ? `(${Math.round(m.latencyMs / 100) / 10}s)` : ''}</span>
                        </div>
                      )}

                      {m.isFallback && m.originalPrompt && (
                        <button
                          type="button"
                          onClick={() => handleSend(m.originalPrompt)}
                          disabled={loading}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-[11px] font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                        >
                          <RotateCcw className="w-3 h-3 text-[#76B93F]" />
                          <span>Retry with Live Gemini</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-[#527367] p-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#76B93F]" />
                <span>Consulting NASA telemetry and agronomic models...</span>
              </div>
            )}
          </div>

          {/* Quick Prompts Bar */}
          <div className="px-6 py-2.5 bg-white border-t border-[#E2E8DE] flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-[11px] font-bold text-[#527367] whitespace-nowrap">Suggested Inquiries:</span>
            {quickPrompts.map((qp, i) => (
              <button
                key={i}
                onClick={() => handleSend(qp)}
                className="px-3 py-1 rounded-full bg-[#F0F5EE] hover:bg-[#EAF5DF] text-[#073D2B] text-[11px] whitespace-nowrap transition-colors border border-[#D5E5CA]"
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="p-4 bg-white border-t border-[#E2E8DE] flex items-center gap-3">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              placeholder="Ask an agronomic question (e.g., 'Compare hairy vetch vs red clover on clay loam')..."
              className="flex-1 px-4 py-2.5 rounded-full border border-[#D5E5CA] bg-white text-xs sm:text-sm text-[#073D2B] focus:outline-hidden focus:ring-2 focus:ring-[#76B93F]"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !prompt.trim()}
              className="p-3 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white disabled:opacity-40 transition-all shadow-xs"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Disclaimer Note */}
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p>
            The Field Shift AI Advisor synthesizes peer-reviewed agronomy and orbital telemetry. It provides
            decision support and educational insights, but does not replace on-site certified crop advisor (CCA)
            evaluations or equipment calibration.
          </p>
        </div>

      </div>
    </div>
  );
};
