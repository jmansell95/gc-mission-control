import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileSignature, Loader2, ShieldCheck, PenLine, CheckCircle2 } from 'lucide-react';
import SignaturePad from '@/components/staff/SignaturePad';

// Reusable e-signature modal for any document, compliance form, or contract.
// Captures a drawn signature, uploads it, and creates a Signature entity record
// with an audit trail (IP, device info, timestamp, document snapshot).

export default function ESignatureModal({
  open,
  onClose,
  documentTitle,
  documentSummary,
  documentType = 'document', // 'compliance' | 'contract' | 'document'
  signerName,
  signerType = 'admin', // 'staff' | 'manager' | 'admin'
  staffId,
  jobId,
  onSigned,
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [signatureData, setSignatureData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [signed, setSigned] = useState(false);
  const signedAtRef = useRef(null);

  const handleSign = async () => {
    if (!signatureData) {
      toast({ title: 'Please draw your signature first', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Upload the signature image
      const blob = await (await fetch(signatureData)).blob();
      const file = new File([blob], `signature-${Date.now()}.png`, { type: 'image/png' });
      const uploadRes = await base44.integrations.Core.UploadPublicFile({ file });
      const signatureUrl = uploadRes.file_url;

      const now = new Date().toISOString();
      signedAtRef.current = now;

      // Capture device info for audit
      const deviceInfo = navigator.userAgent || 'unknown';

      // Create the Signature record
      await base44.entities.Signature.create({
        tier: 'manager_approval',
        signer_type: signerType,
        staff_id: staffId || '',
        staff_name: signerName || '',
        job_id: jobId || '',
        signature_url: signatureUrl,
        signed_at: now,
        device_info: deviceInfo.substring(0, 200),
        payload_snapshot: JSON.stringify({
          document_title: documentTitle,
          document_type: documentType,
          document_summary: documentSummary || '',
          signer_name: signerName,
        }),
        notes: `E-signature for: ${documentTitle}`,
        status: 'active',
      });

      setSigned(true);
      queryClient.invalidateQueries({ queryKey: ['signatures'] });
      toast({ title: 'Document signed successfully', description: documentTitle });

      if (onSigned) {
        onSigned({
          signature_url: signatureUrl,
          signed_at: now,
          signer_name: signerName,
        });
      }
    } catch (err) {
      toast({ title: 'Could not save signature', description: err?.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleClose = () => {
    setSignatureData(null);
    setSigned(false);
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-primary" />
            E-Signature: {documentTitle}
          </DialogTitle>
        </DialogHeader>

        {signed ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <p className="text-lg font-bold text-slate-900">Signature Captured</p>
            <p className="text-sm text-slate-500 mt-1">This document has been digitally signed and recorded for audit purposes.</p>
            {signedAtRef.current && (
              <p className="text-xs text-slate-400 mt-3">
                Signed by {signerName || 'Unknown'} on {new Date(signedAtRef.current).toLocaleString('en-GB')}
              </p>
            )}
            <Button onClick={handleClose} className="mt-6">Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Document summary */}
            {documentSummary && (
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Document Summary</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{documentSummary}</p>
              </div>
            )}

            {/* Audit notice */}
            <div className="flex items-start gap-2 bg-amber-50 rounded-lg p-2.5 border border-amber-100">
              <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                By signing below, you confirm you have reviewed this document. Your signature, timestamp, and device info will be recorded for audit traceability.
              </p>
            </div>

            {/* Signature pad */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <PenLine className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-600">Draw your signature</span>
              </div>
              <SignaturePad onChange={setSignatureData} />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleSign} disabled={!signatureData || saving} className="bg-primary hover:bg-primary/90">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <FileSignature className="w-4 h-4 mr-1.5" />}
                {saving ? 'Saving…' : 'Sign Document'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}