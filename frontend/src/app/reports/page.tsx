"use client";

import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { FileText, Sparkles, Loader2, RefreshCw, Download } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { usePDF } from 'react-to-pdf';
import { api } from "@/lib/api";

export default function ReportsPage() {
  const [summaryReport, setSummaryReport] = useState<string | null>(null);
  const [aiReport, setAiReport] = useState<string | null>(null);
  
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { toPDF: downloadSummary, targetRef: summaryRef } = usePDF({filename: 'system_summary.pdf'});
  const { toPDF: downloadAi, targetRef: aiRef } = usePDF({filename: 'ai_trade_suggestions.pdf'});

  const fetchSummary = async () => {
    setLoadingSummary(true);
    setError(null);
    try {
      const data = await api.getReportSummary();
      if (data.status === "success") {
        setSummaryReport(data.report);
      } else {
        setError(data.message || "Failed to fetch summary report");
      }
    } catch (err) {
      setError("Network error fetching summary report");
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchAiReport = async () => {
    setLoadingAi(true);
    setError(null);
    try {
      const data = await api.getReportSuggestions();
      if (data.status === "success") {
        setAiReport(data.report);
      } else {
        setError(data.message || "Failed to fetch AI report");
      }
    } catch (err) {
      setError("Network error fetching AI report");
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Summary Report Card */}
          <div className="liquid-glass-card p-6 rounded-3xl flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">System Summary</h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Current PnL and active positions</p>
                </div>
              </div>
              <div className="flex gap-2">
                {summaryReport && (
                  <button 
                    onClick={() => downloadSummary()}
                    className="px-4 py-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </button>
                )}
                <button 
                  onClick={fetchSummary}
                  disabled={loadingSummary}
                  className="px-4 py-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 rounded-xl transition-colors flex items-center gap-2"
                >
                  {loadingSummary ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Generate
                </button>
              </div>
            </div>
            
            <div className="flex-1 min-h-[400px] p-6 rounded-2xl bg-white/5 dark:bg-black/20 border border-white/10 overflow-y-auto custom-scrollbar">
              {summaryReport ? (
                <div ref={summaryRef} className="prose prose-blue dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-4 prose-p:text-neutral-600 dark:prose-p:text-neutral-300 prose-li:text-neutral-600 dark:prose-li:text-neutral-300 prose-strong:text-neutral-900 dark:prose-strong:text-white prose-hr:border-white/10">
                  <ReactMarkdown>{summaryReport}</ReactMarkdown>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-neutral-500">
                  <FileText className="w-12 h-12 mb-4 opacity-20" />
                  <p>Click Generate to create a system summary report.</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Suggestions Card */}
          <div className="liquid-glass-card p-6 rounded-3xl flex flex-col h-full shadow-[0_8px_32px_rgba(168,85,247,0.1)]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 flex items-center justify-center border border-purple-500/20">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-400">AI Trade Suggestions</h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Powered by Gemini AI</p>
                </div>
              </div>
              <div className="flex gap-2">
                {aiReport && (
                  <button 
                    onClick={() => downloadAi()}
                    className="px-5 py-2.5 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 rounded-xl transition-all flex items-center gap-2 font-medium border border-purple-500/20 hover:border-purple-500/40 shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </button>
                )}
                <button 
                  onClick={fetchAiReport}
                  disabled={loadingAi}
                  className="px-5 py-2.5 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 rounded-xl transition-all flex items-center gap-2 font-medium border border-purple-500/20 hover:border-purple-500/40 shadow-sm"
                >
                  {loadingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Generate
                </button>
              </div>
            </div>
            
            <div className="flex-1 min-h-[400px] p-6 rounded-2xl bg-white/5 dark:bg-black/20 border border-purple-500/10 overflow-y-auto custom-scrollbar">
              {aiReport ? (
                <div ref={aiRef} className="prose prose-purple dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h1:text-purple-400 prose-h2:text-xl prose-h2:text-purple-300 prose-p:text-neutral-600 dark:prose-p:text-neutral-300 prose-p:leading-relaxed prose-li:text-neutral-600 dark:prose-li:text-neutral-300 prose-strong:text-purple-300 dark:prose-strong:text-purple-200">
                  <ReactMarkdown>{aiReport}</ReactMarkdown>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-neutral-500">
                  <Sparkles className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-center">Click Generate to analyze the market and<br/>get AI-powered manual trade suggestions.</p>
                  <p className="text-xs mt-2 text-neutral-400">(Requires Gemini API Key in Settings)</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
