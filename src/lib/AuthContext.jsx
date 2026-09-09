import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      
      // First, check app public settings (with token if available)
      // This will tell us if auth is required, user not registered, etc.
      try {
        const headers = { 'X-App-Id': appParams.appId };
        if (appParams.token) {
          headers['Authorization'] = `Bearer ${appParams.token}`;
        }
        
        const response = await fetch(`/api/apps/public/prod/public-settings/by-id/${appParams.appId}`, {
          headers,
          credentials: 'include'
        });
        
        let publicSettings = null;
        try { publicSettings = await response.json(); } catch {}
        
        if (!response.ok) {
          const error = new Error(publicSettings?.message || `Request failed with status ${response.status}`);
          error.status = response.status;
          error.data = publicSettings;
          throw error;
        }
        
        setAppPublicSettings(publicSettings);
        
        // Always check user auth — the SDK manages its own token storage internally
        await checkUserAuth();
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        // Handle app-level errors
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message: appError.message
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const ALLOWED_DOMAIN = 'ground-control.co.uk';

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();

      // Domain guard — reject any Microsoft SSO login that isn't a
      // ground-control.co.uk address. Clears the session so the user
      // can't access the app, and surfaces a dedicated error screen.
      const email = (currentUser?.email || '').toLowerCase();
      const isAdmin = currentUser?.role === 'admin';
      if (email && !email.endsWith('@' + ALLOWED_DOMAIN)) {
        try { await base44.auth.logout(); } catch (_) {}
        setUser(null);
        setIsAuthenticated(false);
        setAuthChecked(true);
        setIsLoadingAuth(false);
        setAuthError({
          type: 'domain_not_allowed',
          message: `Access restricted to @${ALLOWED_DOMAIN} emails`,
          email: currentUser?.email,
        });
        return;
      }

      // ── Access gate ──
      // Non-admins must have access_status='approved' to enter the app.
      // 'pending' or undefined → show pending screen (and register them).
      // 'rejected' → show rejection screen.
      if (!isAdmin) {
        const accessStatus = currentUser?.access_status;

        if (accessStatus === 'approved') {
          // Approved — proceed normally
          setUser(currentUser);
          setIsAuthenticated(true);
          setAuthError(null);
          setIsLoadingAuth(false);
          setAuthChecked(true);
        } else if (accessStatus === 'rejected') {
          // Rejected — show rejection screen
          setUser(currentUser);
          setIsAuthenticated(false);
          setAuthChecked(true);
          setIsLoadingAuth(false);
          setAuthError({ type: 'access_rejected', message: 'Access not granted', email: currentUser?.email });
        } else {
          // Pending or undefined — register and show pending screen
          setUser(currentUser);
          setIsAuthenticated(false);
          setAuthChecked(true);
          setIsLoadingAuth(false);
          try {
            const res = await base44.functions.invoke('registerPendingAccess');
            const data = res?.data || res || {};
            if (data.access_status === 'approved') {
              // Auto-approved in the meantime (e.g. staff link)
              setIsAuthenticated(true);
              setAuthError(null);
            } else if (data.access_status === 'rejected') {
              setAuthError({ type: 'access_rejected', message: 'Access not granted', email: currentUser?.email });
            } else {
              setAuthError({
                type: 'access_pending',
                message: 'Awaiting access approval',
                email: currentUser?.email,
                approvers: data.approvers || [],
                contact_instructions: data.contact_instructions || '',
              });
            }
          } catch (e) {
            // If the function fails, still show the pending screen
            setAuthError({
              type: 'access_pending',
              message: 'Awaiting access approval',
              email: currentUser?.email,
              approvers: [],
              contact_instructions: '',
            });
          }
        }
        return;
      }

      // Admins bypass the gate
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      
      // If user auth fails, it might be an expired token
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      base44.auth.logout(window.location.href);
    } else {
      // Just remove the token without redirect
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    // Use the SDK's redirectToLogin method
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};