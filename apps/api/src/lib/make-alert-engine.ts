import type { SupabaseClient } from '@supabase/supabase-js';
import { PropertyAlertEngine } from '@realflow/business-logic';

/**
 * Factory that creates a PropertyAlertEngine with stub notifiers.
 * Replace each stub with a real service when notification infrastructure is wired (Sprint 6).
 */
export function makeAlertEngine(supabase: SupabaseClient): PropertyAlertEngine {
  return new PropertyAlertEngine(
    supabase,
    async () => {}, // push  — wire PushService in Sprint 6
    async () => {}, // email — wire GmailClient / SendGrid in Sprint 6
    async () => {}, // sms   — wire TwilioClient in Sprint 6
  );
}
