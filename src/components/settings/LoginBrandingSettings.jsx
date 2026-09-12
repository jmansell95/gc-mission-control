import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Palette, Eye, Save, Upload, X, Plus, Trash2,
  Monitor, Sparkles, Waves, Wind, Grid3x3, ImageOff,
  ChevronRight, ChevronLeft, Clock, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import DivisionLoginAnimation from '@/components/login/DivisionLoginAnimation';
import { EMBLEM_URL } from '@/components/Logo';

const ANIMATION_TYPES = [
  { key: 'themed_scene', label: 'Themed Scene', icon: Monitor, description: 'Division-specific SVG scene (drilling rig, water waves, etc.)' },
  { key: 'particle_field', label: 'Particle Field', icon: Sparkles, description: 'Floating particles in brand colours' },
  { key: 'flowing_lines', label: 'Flowing Lines', icon: Wind, description: 'Animated flowing lines across the screen' },
  { key: 'gradient_mesh', label: 'Gradient Mesh', icon: Grid3x3, description: 'Animated gradient mesh background' },
  { key: 'none', label: 'Static', icon: ImageOff, description: 'Static gradient only, no animation' },
];

const TRANSITION_STYLES = [
  { key: 'fade', label: 'Fade' },
  { key: 'slide_up', label: 'Slide Up' },
  { key: 'zoom', label: 'Zoom' },
  { key: 'slide_right', label: 'Slide Right' },
];

/**
 * LoginBrandingSettings — Enterprise Settings tab for configuring per-division
 * login animation and branding. Admins choose an animation type, set brand
 * colours, upload a logo, configure welcome text, and preview the result live.
 */
export default function LoginBrandingSettings({ divisions, canEditAll }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDivisionId, setSelectedDivisionId] = useState(null);
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [emailDomainInput, setEmailDomainInput] = useState('');

  // Select first division by default
  useEffect(() => {
    if (!selectedDivisionId && divisions.length > 0) {
      setSelectedDivisionId(canEditAll ? divisions[0].id : divisions.find(d => d.is_active !== false)?.id || divisions[0]?.id);
    }
  }, [divisions, selectedDivisionId, canEditAll]);

  const selectedDivision = divisions.find(d => d.id === selectedDivisionId);

  // Load the division's current config
  useEffect(() => {
    if (!selectedDivision) { setConfig(null); return; }
    const cfg = selectedDivision.login_animation_config || {};
    setConfig({
      animation_type: cfg.animation_type || 'themed_scene',
      primary_color: cfg.primary_color || selectedDivision.color || '#2E5A1A',
      secondary_color: cfg.secondary_color || '#1c4a12',
      accent_color: cfg.accent_color || '#8DC63F',
      logo_url: cfg.logo_url || selectedDivision.logo_url || '',
      welcome_text: cfg.welcome_text || `Welcome to ${selectedDivision.name}`,
      tagline: cfg.tagline || selectedDivision.tagline || '',
      duration_ms: cfg.duration_ms || 2500,
      transition_style: cfg.transition_style || 'fade',
      show_progress_bar: cfg.show_progress_bar !== false,
    });
    setEmailDomainInput('');
  }, [selectedDivisionId, selectedDivision]);

  const update = (field, value) => setConfig(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!selectedDivision) return;
    setSaving(true);
    try {
      const emailDomains = selectedDivision.email_domains || [];
      const loginConfig = { ...config };
      await base44.entities.Division.update(selectedDivision.id, {
        login_animation_config: loginConfig,
        email_domains: emailDomains,
      });
      // Audit log
      await base44.functions.invoke('logSystemAudit', {
        action: 'update_login_branding',
        entity_type: 'Division',
        entity_id: selectedDivision.id,
        details: `Updated login animation & branding for ${selectedDivision.name}`,
      });
      queryClient.invalidateQueries({ queryKey: ['divisions-for-login'] });
      queryClient.invalidateQueries({ queryKey: ['divisions-for-login-picker'] });
      toast({ title: 'Saved', description: `Login branding for ${selectedDivision.name} updated.` });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleLogoUpload = async (file) => {
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      update('logo_url', file_url);
      toast({ title: 'Logo uploaded' });
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    }
  };

  const addEmailDomain = () => {
    if (!emailDomainInput.trim()) return;
    const domains = selectedDivision.email_domains || [];
    if (domains.includes(emailDomainInput.trim())) return;
    base44.entities.Division.update(selectedDivision.id, {
      email_domains: [...domains, emailDomainInput.trim()],
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['divisions-for-login'] });
      setEmailDomainInput('');
      toast({ title: 'Email domain added' });
    });
  };

  const removeEmailDomain = (domain) => {
    const domains = (selectedDivision.email_domains || []).filter(d => d !== domain);
    base44.entities.Division.update(selectedDivision.id, { email_domains: domains }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['divisions-for-login'] });
      toast({ title: 'Email domain removed' });
    });
  };

  if (!selectedDivision || !config) {
    return <div className="hub-glass rounded-2xl p-8 text-center text-sm text-slate-400">No divisions available</div>;
  }

  // Build preview config
  const previewConfig = {
    division: selectedDivision,
    animationType: config.animation_type,
    primaryColor: config.primary_color,
    secondaryColor: config.secondary_color,
    accentColor: config.accent_color,
    logoUrl: config.logo_url || null,
    welcomeText: config.welcome_text,
    tagline: config.tagline,
    durationMs: config.duration_ms,
    transitionStyle: config.transition_style,
    showProgressBar: config.show_progress_bar,
  };

  return (
    <div className="space-y-4">
      {/* Division selector */}
      {canEditAll && divisions.length > 1 && (
        <div className="hub-glass rounded-2xl p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Division:</span>
            <select
              value={selectedDivisionId || ''}
              onChange={e => setSelectedDivisionId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold focus:outline-none focus:border-primary"
            >
              {divisions.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                <Eye className="w-3.5 h-3.5" /> Preview
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Animation type gallery */}
        <div className="hub-glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold text-slate-900">Animation Type</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {ANIMATION_TYPES.map(at => {
              const Icon = at.icon;
              const active = config.animation_type === at.key;
              return (
                <button
                  key={at.key}
                  onClick={() => update('animation_type', at.key)}
                  className={`text-left p-3 rounded-xl border transition ${
                    active ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${active ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold text-slate-800">{at.label}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-snug">{at.description}</p>
                </button>
              );
            })}
          </div>

          {/* Brand colours */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Brand Colours</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-500 font-medium mb-1 block">Primary</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={config.primary_color} onChange={e => update('primary_color', e.target.value)} className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer" />
                  <input type="text" value={config.primary_color} onChange={e => update('primary_color', e.target.value)} className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium mb-1 block">Secondary</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={config.secondary_color} onChange={e => update('secondary_color', e.target.value)} className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer" />
                  <input type="text" value={config.secondary_color} onChange={e => update('secondary_color', e.target.value)} className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium mb-1 block">Accent</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={config.accent_color} onChange={e => update('accent_color', e.target.value)} className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer" />
                  <input type="text" value={config.accent_color} onChange={e => update('accent_color', e.target.value)} className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Text, logo, timing */}
        <div className="hub-glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold text-slate-900">Content & Timing</h3>
          </div>

          {/* Logo */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Logo</label>
            <div className="flex items-center gap-3">
              {config.logo_url ? (
                <img src={config.logo_url} alt="Logo" className="h-12 w-auto object-contain rounded-lg border border-slate-200 p-1" />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center">
                  <ImageOff className="w-5 h-5 text-slate-300" />
                </div>
              )}
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={e => handleLogoUpload(e.target.files?.[0])} />
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition">
                  <Upload className="w-3.5 h-3.5" /> Upload
                </span>
              </label>
              {config.logo_url && (
                <button onClick={() => update('logo_url', '')} className="text-xs text-rose-500 hover:text-rose-600 font-semibold">Remove</button>
              )}
            </div>
          </div>

          {/* Welcome text */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Welcome Text</label>
            <input
              value={config.welcome_text}
              onChange={e => update('welcome_text', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {/* Tagline */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Tagline</label>
            <input
              value={config.tagline}
              onChange={e => update('tagline', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Duration: {(config.duration_ms / 1000).toFixed(1)}s
            </label>
            <input
              type="range" min="1000" max="5000" step="500"
              value={config.duration_ms}
              onChange={e => update('duration_ms', parseInt(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          {/* Transition style */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Transition Style
            </label>
            <div className="flex gap-2">
              {TRANSITION_STYLES.map(t => (
                <button
                  key={t.key}
                  onClick={() => update('transition_style', t.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    config.transition_style === t.key ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Progress bar toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.show_progress_bar}
              onChange={e => update('show_progress_bar', e.target.checked)}
              className="w-4 h-4 rounded accent-primary"
            />
            <span className="text-sm text-slate-600">Show progress bar</span>
          </label>
        </div>
      </div>

      {/* Email domains */}
      <div className="hub-glass rounded-2xl p-5 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Email Domain Auto-Detection</h3>
          <p className="text-xs text-slate-400 mt-0.5">When a user enters an email on the login page, the system auto-selects the division whose email domains match.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={emailDomainInput}
            onChange={e => setEmailDomainInput(e.target.value)}
            placeholder="e.g. ground-control.co.uk"
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary"
            onKeyDown={e => e.key === 'Enter' && addEmailDomain()}
          />
          <Button size="sm" onClick={addEmailDomain}>
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(selectedDivision.email_domains || []).map(domain => (
            <span key={domain} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
              {domain}
              <button onClick={() => removeEmailDomain(domain)} className="text-slate-400 hover:text-rose-500">
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
          {(selectedDivision.email_domains || []).length === 0 && (
            <span className="text-xs text-slate-400">No email domains configured — users will see the default division animation.</span>
          )}
        </div>
      </div>

      {/* Preview modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="relative w-full max-w-3xl h-[60vh] rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <DivisionLoginAnimation config={previewConfig} fullScreen />
            <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6">
              {config.logo_url ? (
                <img src={config.logo_url} alt="Logo" className="h-20 w-auto object-contain drop-shadow-2xl mb-6" />
              ) : (
                <img src={EMBLEM_URL} alt="Ground Control" className="h-20 w-auto object-contain drop-shadow-2xl mb-6" />
              )}
              <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-lg">{config.welcome_text}</h1>
              {config.tagline && <p className="text-lg text-white/70 mt-2 font-medium drop-shadow-sm">{config.tagline}</p>}
              {config.show_progress_bar && (
                <div className="mt-8 w-48 h-1 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full rounded-full bg-white" style={{ width: '60%' }} />
                </div>
              )}
            </div>
            <button onClick={() => setShowPreview(false)} className="absolute top-4 right-4 z-20 p-2 rounded-lg bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}