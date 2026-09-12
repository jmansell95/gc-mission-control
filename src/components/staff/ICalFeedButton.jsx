import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Calendar, Loader2, Download } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * Downloads an iCal (.ics) file of a staff member's upcoming rota assignments
 * so the schedule can be imported into a phone or desktop calendar app.
 */
export default function ICalFeedButton({ staffId, staffName, className = '' }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getStaffICalFeed', { staff_id: staffId });
      const ical = res?.data?.ical || res?.ical;
      if (!ical) throw new Error('No calendar data returned');
      const blob = new Blob([ical], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(staffName || 'staff').replace(/\s+/g, '_')}_schedule.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Calendar downloaded', description: `${res?.data?.count ?? res?.count ?? 0} upcoming assignments — import into your calendar app.` });
    } catch (e) {
      toast({ title: 'Could not generate calendar', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary transition disabled:opacity-50 ${className}`}
      title="Download schedule as a calendar file"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
      {loading ? 'Generating…' : 'Calendar'}
    </button>
  );
}