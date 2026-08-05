"use client";

import { Sparkles, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

export default function LlmSettingsPanel() {
  const queryClient = useQueryClient();
  
  const { data: config, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig
  });

  const [formData, setFormData] = useState({
    llm_api_key: ""
  });

  useEffect(() => {
    if (config) {
      setFormData({
        llm_api_key: config.llm_api_key ?? ""
      });
    }
  }, [config]);

  const mutation = useMutation({
    mutationFn: api.updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      toast.success("LLM API Key saved");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (isLoading) {
    return <div className="liquid-glass-card p-6 h-40 glass-skeleton rounded-2xl" />;
  }

  return (
    <div className="liquid-glass-card p-6 relative overflow-hidden group">
      <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-purple-400">
        <Sparkles className="w-5 h-5" />
        AI Reports (Gemini API)
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Gemini API Key</label>
          <input
            type="password"
            value={formData.llm_api_key}
            onChange={(e) => setFormData(prev => ({ ...prev, llm_api_key: e.target.value }))}
            placeholder="AIzaSy..."
            className="w-full mt-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all text-neutral-800 dark:text-white"
          />
          <p className="text-xs text-neutral-500 mt-2">
            Required to generate AI trade suggestions. Your key is stored locally in the bot's database.
          </p>
        </div>
        
        <button 
          type="submit" 
          disabled={mutation.isPending}
          className="w-full bg-purple-600/20 text-purple-500 hover:bg-purple-600/30 rounded-xl py-3 font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm mt-4"
        >
          <Save className="w-4 h-4" />
          {mutation.isPending ? "Saving..." : "Save LLM Config"}
        </button>
      </form>
    </div>
  );
}
