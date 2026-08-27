import { base44 } from '@/api/base44Client';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Sends the password-setup email after an inviteUser call.
 *
 * inviteUser creates the user account asynchronously, so resetPasswordRequest
 * fired immediately after often fails because the account hasn't propagated yet.
 * This waits for the account to settle, then calls resetPasswordRequest with
 * one retry. Returns { ok: boolean, error?: string }.
 *
 * The caller is responsible for surfacing a warning to the admin when ok is false.
 */
export async function sendPasswordSetupEmail(email) {
  await sleep(3000);
  try {
    await base44.auth.resetPasswordRequest(email);
    return { ok: true };
  } catch (e) {
    await sleep(2000);
    try {
      await base44.auth.resetPasswordRequest(email);
      return { ok: true };
    } catch (e2) {
      return { ok: false, error: e2?.message || e?.message || 'Failed' };
    }
  }
}