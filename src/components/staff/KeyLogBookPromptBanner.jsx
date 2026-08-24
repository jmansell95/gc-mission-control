import React, { useState, useEffect } from 'react';
import { Tablet, X, ArrowRight } from 'lucide-react';

function londonTodayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function londonHour() {
  return parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hour12: false }).format(new Date()), 10);
}

/**
 * KeyLogBookPromptBanner — dismissible afternoon banner shown to drillers
 * on the staff dashboard, reminding them to log activities in KeyLogBook.
 * Appears after 3pm Europe/London and resets daily via localStorage.
 */
export default function KeyLogBookPromptBanner({ staff }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(`klb_prompt_dismissed_${londonTodayStr()}`) === 'true');
  }, []);

  const isDriller = /driller/i.test(staff?.job_title || '');
  const isAfternoon = londonHour() >= 15;

  if (!isDriller || !isAfternoon || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(`klb_prompt_dismissed_${londonTodayStr()}`, 'true');
    setDismissed(true);
  };

  return (
    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] text-white shadow-lg shadow-[#2E5A1A]/20 animate-slide-up">
      <button onClick={handleDismiss} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/15 transition z-10">
        <X className="w-4 h-4 text-white/70" />
      </button>
      <div className="px-5 py-4 pr-12">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0">
            <Tablet className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight">Time to log on KeyLogBook</p>
            <p className="text-[13px] text-white/85 mt-1 leading-relaxed">
              Grab your tablet and start logging your daily activities on KeyLogBook — all data will be sent back to the office automatically. Once you're done logging, come back here to close off your shift for the day.
            </p>
            <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-white/60">
              <ArrowRight className="w-3 h-3" />
              <span>Your activities auto-link to rates and pull financial figures in automatically.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}