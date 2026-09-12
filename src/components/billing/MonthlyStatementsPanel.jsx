import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  FileText, Send, Loader2, ChevronLeft, ChevronRight, Mail, AlertCircle,
  CheckCircle2, Eye, Inbox,
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

const gbp = (n) => '£' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EMAIL_META = {
  sent_client: { tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', Icon: CheckCircle2, label: 'Sent to client' },
  sent_admin_fallback: { tone: 'text-amber-700 bg-amber-50 border-amber-200', Icon: Inbox, label: 'Sent to you' },
  failed: { tone: 'text-red-700 bg-red-50 border-red-200', Icon: AlertCircle, label: 'Failed' },
  skipped: { tone: 'text-slate-500 bg-slate-50 border-slate-200', Icon: Mail, label: 'Not emailed' },
};

export default function MonthlyStatementsPanel({ companyName }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const [month, setMonth] = useState(`${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState(null);
  const [previews, setPreviews] = useState({}); // client_id -> html

  const { data: clients = [] } = useQuery({ queryKey: ['billing-clients'], queryFn: () => base44.entities.Client.list() });

  const monthLabel = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }, [month]);

  const shiftMonth = (delta) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    setResults(null);
  };

  const handleGenerate = async (sendEmail = true) => {
    setGenerating(true);
    try {
      const res = await base44.functions.invoke('generateMonthlyStatements', {
        month, send_email: sendEmail, include_html: true,
      });
      const d = res.data || res;
      setResults(d);
      // Cache preview html
      if (Array.isArray(d.results)) {
        const map = {};
        d.results.forEach((r) => { if (r.preview_html) map[r.client_id] = r.preview_html; });
        setPreviews(map);
      }
      toast({
        title: sendEmail ? `${d.client_count} statement(s) sent` : `${d.client_count} statement(s) prepared`,
        description: d.message,
      });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (e) {
      toast({ title: e?.response?.data?.error || 'Generation failed', variant: 'destructive' });
    }
    setGenerating(false);
  };

  const preview = (clientId) => {
    const html = previews[clientId];
    if (!html) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div>
      {/* Month navigator + actions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
            <button onClick={() => shiftMonth(-1)} className="p-1 text-slate-400 hover:text-slate-700 rounded transition">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 min-w-[150px] justify-center">
              <FileText className="w-4 h-4 text-primary" />
              {monthLabel}
            </div>
            <button onClick={() => shiftMonth(1)} className="p-1 text-slate-400 hover:text-slate-700 rounded transition">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
            <button onClick={() => handleGenerate(false)} disabled={generating}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition disabled:opacity-50">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              Prepare previews
            </button>
            <button onClick={() => handleGenerate(true)} disabled={generating}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Generate &amp; email
            </button>
          </div>
        </div>
        <div className="flex items-start gap-2 mt-3 text-xs text-slate-500 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <Mail className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <span>Statements are emailed directly to each client's contact. If a client's email isn't a registered app user, the statement is sent to <strong>you</strong> for forwarding. A scheduled automation can also send these automatically on the 1st of each month.</span>
        </div>
      </div>

      {/* Results */}
      {results ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{results.client_count} statement(s) · {monthLabel}</h3>
              <p className="text-xs text-slate-400">{results.message}</p>
            </div>
          </div>
          {results.results.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No invoices were raised during {monthLabel}.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {results.results.map((r) => {
                const meta = EMAIL_META[r.email_status] || EMAIL_META.skipped;
                const client = clients.find((c) => c.id === r.client_id);
                return (
                  <div key={r.client_id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{r.client_name}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {r.invoice_count} invoice(s) · Total {gbp(r.total_gross)}
                        {r.outstanding > 0 && <span className="text-amber-600 font-medium"> · {gbp(r.outstanding)} outstanding</span>}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border ${meta.tone}`}>
                      <meta.Icon className="w-3 h-3" /> {meta.label}
                    </span>
                    {previews[r.client_id] && (
                      <button onClick={() => preview(r.client_id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 text-white rounded-lg text-[11px] font-semibold hover:bg-slate-900 transition">
                        <Eye className="w-3 h-3" /> View / print
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
          <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">No statements prepared yet for {monthLabel}</p>
          <p className="text-xs text-slate-400 mt-1">Pick a month and choose "Prepare previews" to inspect, or "Generate &amp; email" to send straight away.</p>
        </div>
      )}
    </div>
  );
}