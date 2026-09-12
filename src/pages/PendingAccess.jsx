import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, LogOut } from 'lucide-react';
import Logo from '@/components/Logo';

export default function PendingAccess() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLogout = async () => {
    await base44.auth.logout('/login');
  };

  return (
    <div className="min-h-screen page-bg-vibrant flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="flex flex-col items-center mb-8">
          <Logo height={48} />
        </div>
        <div className="hub-glass rounded-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-amber-600" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 mb-2">Awaiting Business Stream Assignment</h1>
          <p className="text-sm text-slate-500 mb-1">
            Your account hasn't been assigned to a division yet.
          </p>
          <p className="text-sm text-slate-500 mb-6">
            Please contact your administrator to get access to a division workspace.
          </p>
          {user?.email && (
            <div className="mb-6 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wide mb-1">Logged in as</p>
              <p className="text-sm font-semibold text-slate-700 truncate">{user.email}</p>
            </div>
          )}
          <Button onClick={handleLogout} variant="outline" className="w-full">
            <LogOut className="w-4 h-4 mr-2" />
            Log Out
          </Button>
        </div>
      </div>
    </div>
  );
}