"use client";

import { useState, useEffect } from "react";
import { AlertOctagon, X, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";

export default function KillSwitchButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [countdown, setCountdown] = useState(-1); // -1 = inactive, >0 = counting, 0 = fire

  const mutation = useMutation({
    mutationFn: api.killBot,
    onSuccess: () => {
      handleClose();
    }
  });

  const handleClose = () => {
    setIsOpen(false);
    setCountdown(-1); // Reset countdown on close
  };

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      // Only fires after counting down from a positive number (user confirmed)
      mutation.mutate();
    }
  }, [countdown]);

  const handleTrigger = () => {
    setCountdown(3);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-2 pointer-events-auto shadow-[0_0_15px_rgba(239,68,68,0.2)]"
        title="Emergency Kill Switch"
      >
        <AlertOctagon className="w-5 h-5" />
        <span className="text-sm font-bold uppercase tracking-wider hidden md:block">Kill Switch</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => {
                if (countdown <= 0 || countdown === 3) handleClose();
              }}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-[#151518] border border-red-500/20 shadow-2xl rounded-2xl overflow-hidden"
            >
              <div className="p-6">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6 mx-auto">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                
                <h2 className="text-2xl font-bold text-center mb-2 text-neutral-900 dark:text-white">
                  EMERGENCY STOP
                </h2>
                <p className="text-center text-neutral-500 dark:text-neutral-400 mb-8">
                  This will immediately halt the trading bot and market close all open positions. This action cannot be undone.
                </p>

                {countdown > 0 && countdown < 3 ? (
                  <div className="text-center py-4">
                    <p className="text-red-500 font-bold text-xl animate-pulse">
                      Closing all positions in {countdown}...
                    </p>
                  </div>
                ) : mutation.isPending ? (
                  <div className="text-center py-4">
                    <p className="text-red-500 font-bold text-xl animate-pulse">
                      Executing Kill Switch...
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={handleClose}
                      className="px-4 py-3 rounded-xl bg-neutral-100 dark:bg-white/5 text-neutral-900 dark:text-white font-semibold hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleTrigger}
                      className="px-4 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-colors"
                    >
                      CONFIRM KILL
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
