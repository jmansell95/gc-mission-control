import React, { createContext, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, HardHat, Sparkles, BrainCircuit, ArrowRight, Zap } from 'lucide-react';
import { useStaffAssistant } from '@/components/StaffAssistantChat';
import { useDrillingIntelligence } from '@/components/DrillingIntelligenceChat';
import { useSchedulingAssistant } from '@/components/SchedulingAssistantChat';

const AIHubContext = createContext({ openHub: () => {}, closeHub: () => {} });

export function useAIHub() {
  return useContext(AIHubContext);
}

const AGENTS = [
  {
    id: 'drilling',
    name: 'Drilling AI',
    description: 'Hazard analysis, strata logs, rig compliance & drilling rotas',
    icon: HardHat,
    gradient: 'from-[#2E5A1A] to-[#5A8C1E]',
    glow: 'glow-brand',
    accent: 'text-primary',
    bg: 'bg-primary/5',
    border: 'border-primary/20',
  },
  {
    id: 'assistant',
    name: 'AI Assistant',
    description: 'Schedules, timesheets, rotas, vehicle mileage & trip history',
    icon: Sparkles,
    gradient: 'from-[#1565C0] to-[#1976D2]',
    glow: 'glow-blue',
    accent: 'text-[#1565C0]',
    bg: 'bg-[#1565C0]/5',
    border: 'border-[#1565C0]/20',
  },
  {
    id: 'scheduling',
    name: 'Scheduling AI',
    description: 'Build weekly rotas, find available crew, assign staff',
    icon: BrainCircuit,
    gradient: 'from-[#6A1B9A] to-[#7B1FA2]',
    glow: 'glow-emerald',
    accent: 'text-[#6A1B9A]',
    bg: 'bg-[#6A1B9A]/5',
    border: 'border-[#6A1B9A]/20',
  },
];

export function AIHubProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const { openChat: openStaff } = useStaffAssistant();
  const { openChat: openDrilling } = useDrillingIntelligence();
  const { openChat: openScheduling } = useSchedulingAssistant();

  const openHub = () => setIsOpen(true);
  const closeHub = () => setIsOpen(false);

  const handleSelect = (agentId) => {
    setIsOpen(false);
    setTimeout(() => {
      if (agentId === 'drilling') openDrilling();
      else if (agentId === 'assistant') openStaff();
      else if (agentId === 'scheduling') openScheduling();
    }, 250);
  };

  return (
    <AIHubContext.Provider value={{ openHub, closeHub }}>
      {children}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[75] flex items-end lg:items-center justify-center lg:p-4"
          >
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={closeHub} />
            <motion.div
              initial={{ y: '100%', opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative bg-slate-50 rounded-t-3xl lg:rounded-3xl shadow-2xl w-full lg:max-w-md h-[85vh] lg:h-auto lg:max-h-[640px] flex flex-col overflow-hidden ring-1 ring-black/5"
            >
              {/* Header — vibrant gradient */}
              <div className="relative hero-vibrant px-5 py-5 overflow-hidden flex-shrink-0">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-2xl bg-white/20 animate-ping opacity-60" style={{ animationDuration: '2.5s' }} />
                      <div className="relative w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center ring-1 ring-white/25 backdrop-blur-sm">
                        <Zap className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div>
                      <p className="text-white font-bold text-lg tracking-tight">AI Hub</p>
                      <p className="text-white/70 text-xs">Choose your AI assistant</p>
                    </div>
                  </div>
                  <button onClick={closeHub} className="p-2 text-white/80 hover:bg-white/15 hover:text-white rounded-xl transition flex-shrink-0 active:scale-90">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Agent tiles */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-slate-50 to-slate-100/50">
                {AGENTS.map((agent, i) => {
                  const Icon = agent.icon;
                  return (
                    <motion.button
                      key={agent.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * i }}
                      onClick={() => handleSelect(agent.id)}
                      className={`w-full flex items-center gap-4 p-4 bg-white rounded-2xl border ${agent.border} hover:border-transparent hover:shadow-lg transition group text-left active:scale-[0.98]`}
                    >
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${agent.gradient} flex items-center justify-center shadow-md flex-shrink-0 ${agent.glow}`}>
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold text-slate-900">{agent.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-snug">{agent.description}</p>
                      </div>
                      <ArrowRight className={`w-5 h-5 ${agent.accent} opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition flex-shrink-0`} />
                    </motion.button>
                  );
                })}
                <p className="text-center text-xs text-slate-400 pt-2">More AI agents coming soon</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AIHubContext.Provider>
  );
}