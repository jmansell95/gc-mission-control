import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Download, Mail } from 'lucide-react';
import { format, startOfWeek } from 'date-fns';

export default function PrintEmailSchedule({ weekStart, staffId, staffName }) {
  const [loading, setLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [message, setMessage] = useState('');

  const handlePrint = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('generateRotaPDF', {
        weekStart: format(weekStart, 'yyyy-MM-dd'),
        staffId: staffId || null
      });

      // Create a blob and download
      const htmlContent = response.data.html;
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = response.data.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setMessage('Schedule downloaded successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error printing schedule:', error);
      setMessage('Error generating schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await base44.functions.invoke('sendScheduleEmail', {
        weekStart: format(weekStart, 'yyyy-MM-dd'),
        staffId: staffId || null,
        recipientEmail: emailRecipient
      });

      setMessage('Schedule emailed successfully');
      setShowEmailForm(false);
      setEmailRecipient('');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error sending email:', error);
      setMessage('Error sending email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {message && (
        <div className="px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
        <button
          onClick={handlePrint}
          disabled={loading}
          className="flex items-center justify-center md:justify-start gap-2 px-4 py-2 md:py-3 bg-[#2E5A1A] text-white rounded-lg hover:bg-[#244715] transition disabled:opacity-50 text-sm md:text-base font-medium active:scale-95 flex-1 sm:flex-none"
        >
          <Download className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
          <span className="hidden md:inline">Download</span>
        </button>

        <button
          onClick={() => setShowEmailForm(!showEmailForm)}
          disabled={loading}
          className="flex items-center justify-center md:justify-start gap-2 px-4 py-2 md:py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 text-sm md:text-base font-medium active:scale-95 flex-1 sm:flex-none"
        >
          <Mail className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
          <span className="hidden md:inline">Email</span>
        </button>
      </div>

      {showEmailForm && (
        <form onSubmit={handleEmailSubmit} className="bg-slate-50 border border-slate-200 rounded-lg p-3 md:p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
            <input
              type="email"
              value={emailRecipient}
              onChange={(e) => setEmailRecipient(e.target.value)}
              placeholder={staffName ? 'staff@example.com' : 'manager@example.com'}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-600"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 font-medium text-sm"
            >
              {loading ? 'Sending...' : 'Send Email'}
            </button>
            <button
              type="button"
              onClick={() => setShowEmailForm(false)}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-medium text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}