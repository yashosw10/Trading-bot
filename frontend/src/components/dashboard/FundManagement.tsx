"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";
import CustomSelect from "../ui/CustomSelect";
import type { Currency } from "@/types/api";
import type { AddFundsPayload } from "@/types/fund";
import { ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function FundManagement({ defaultCurrency }: { defaultCurrency: Currency }) {
  const queryClient = useQueryClient();
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [amount, setAmount] = useState<number>(1000);
  const [clearHistory, setClearHistory] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: AddFundsPayload) => api.addFunds(payload),
    onSuccess: () => {
      queryClient.invalidateQueries(); // Refresh all data
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ currency, amount, clear_history: clearHistory });
  };

  return (
    <div className="liquid-glass-card p-6">
      <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
        <span className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
          💰
        </span>
        Add Funds
      </h3>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Currency</label>
          <CustomSelect
            value={currency}
            onChange={(val) => setCurrency(val as Currency)}
            options={[
              { label: "USD", value: "USD" },
              { label: "INR", value: "INR" },
              { label: "EUR", value: "EUR" }
            ]}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Amount</label>
          <input
            type="number"
            min={1}
            step={100}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full bg-white/40 dark:bg-black/70 border border-white/20 dark:border-[rgba(100,255,255,0.2)] rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/50 backdrop-blur-md transition-all text-neutral-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2 py-1 mt-1">
          <input
            type="checkbox"
            id="clear_history"
            checked={clearHistory}
            onChange={(e) => setClearHistory(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 mt-[1px]"
          />
          <label htmlFor="clear_history" className="text-sm text-neutral-600 dark:text-neutral-300 cursor-pointer select-none">
            Clear existing history
          </label>
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full bg-[#224488] hover:bg-blue-800 text-white shadow-[0_0_10px_rgba(34,68,136,0.5)] dark:shadow-[0_0_15px_rgba(34,68,136,0.8)] rounded-xl py-3 font-semibold flex items-center justify-center gap-2 group transition-all"
        >
          {mutation.isPending ? "Processing..." : "Add Funds"}
          {!mutation.isPending && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
        </button>
      </form>

      <AnimatePresence>
        {mutation.isSuccess && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 16 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm flex items-start gap-2"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p>{mutation.data?.message}</p>
          </motion.div>
        )}

        {mutation.isError && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 16 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-start gap-2"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{mutation.error?.message || "Failed to add funds. Check connection."}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
