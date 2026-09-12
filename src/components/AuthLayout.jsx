import React from "react";
import { useLoginBranding } from "@/hooks/useLoginBranding";
import { EMBLEM_URL } from "@/components/Logo";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  const branding = useLoginBranding();

  const isImage = branding.background_type === 'image' && branding.background_image_url;
  const isSolid = branding.background_type === 'solid';
  const isGradient = !isImage && !isSolid;

  const bgStyle = isImage
    ? { backgroundImage: `url(${branding.background_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : isSolid
      ? { background: branding.primary_color }
      : {};

  const bgClass = isGradient ? 'mesh-bg' : '';

  const overlayStyle = isImage
    ? { background: `rgba(0,0,0,${branding.overlay_opacity})` }
    : {};

  const cardCls = branding.card_style === 'glass'
    ? 'glass border border-white/30 shadow-2xl'
    : branding.card_style === 'bordered'
      ? 'bg-white border-2 border-slate-200 shadow-sm'
      : 'bg-white border border-slate-200 shadow-xl';

  const displayTitle = branding.welcome_title && title === 'Welcome back' ? branding.welcome_title : title;
  const displaySubtitle = branding.welcome_subtitle && subtitle === 'Log in to your account' ? branding.welcome_subtitle : subtitle;

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 py-8 ${bgClass}`} style={bgStyle}>
      <div className="absolute inset-0" style={overlayStyle} />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-10">
          {branding.show_logo && branding.logo_url ? (
            <img src={branding.logo_url} alt="Logo" className="mx-auto h-14 w-auto mb-4 object-contain" />
          ) : (
            <img src={EMBLEM_URL} alt="Ground Control" className="mx-auto h-16 w-auto mb-4 object-contain drop-shadow-lg" />
          )}
          <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-sm whitespace-pre-line">{displayTitle}</h1>
          {displaySubtitle && <p className="text-white/80 mt-2 drop-shadow-sm">{displaySubtitle}</p>}
        </div>
        <div className={`rounded-2xl p-8 ${cardCls}`}>
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-white/70 mt-6 drop-shadow-sm">{footer}</p>
        )}
        {branding.footer_text && !footer && (
          <p className="text-center text-sm text-white/70 mt-6 drop-shadow-sm">{branding.footer_text}</p>
        )}
        <p className="text-center text-[11px] text-white/50 mt-4 drop-shadow-sm">
          This application was created by Jordan Mansell
        </p>
      </div>
    </div>
  );
}