import type { SupabaseClient } from '@supabase/supabase-js';
import { DealHealthCalculator } from '@realflow/business-logic';
import type { DealHealthInput } from '@realflow/shared';

export async function getDealHealth(
  supabase: SupabaseClient,
  input: Record<string, unknown>,
): Promise<string> {
  const dealId = input.deal_id as string;
  if (!dealId) return JSON.stringify({ error: 'deal_id is required' });

  // Fetch deal + activities + tasks in parallel
  const [dealResult, activitiesResult, tasksResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, pipeline_type, current_stage, created_at, updated_at, contact_id')
      .eq('id', dealId)
      .eq('is_deleted', false)
      .single(),
    supabase
      .from('activities')
      .select('id, type, created_at')
      .eq('transaction_id', dealId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('tasks')
      .select('id, status, due_date, completed_at')
      .eq('transaction_id', dealId),
  ]);

  if (dealResult.error) {
    return JSON.stringify({ error: `Deal not found: ${dealResult.error.message}` });
  }

  const deal = dealResult.data;
  const activities = activitiesResult.data ?? [];
  const tasks = tasksResult.data ?? [];

  const now = new Date();
  const nowIso = now.toISOString();
  const thirtyDaysAgo = now.getTime() - 30 * 86400_000;
  const sevenDaysAgo = now.getTime() - 7 * 86400_000;

  const lastActivity = activities[0];
  const activitiesLast30 = activities.filter((a) => new Date(a.created_at).getTime() > thirtyDaysAgo);
  const activitiesLast7 = activities.filter((a) => new Date(a.created_at).getTime() > sevenDaysAgo);

  const healthInput: DealHealthInput = {
    pipelineType: deal.pipeline_type as 'buying' | 'selling' | 'buyers-agent',
    currentStage: deal.current_stage,
    stageEnteredAt: deal.updated_at,
    dealCreatedAt: deal.created_at,
    lastContactDate: lastActivity?.created_at ?? null,
    activitiesLast30Days: activitiesLast30.length,
    activitiesLast7Days: activitiesLast7.length,
    averageDaysInStage: null, // No org-wide average available yet
    budgetConfirmed: false, // Would need contact/brief data for accurate values
    timelineConfirmed: false,
    motivationAssessed: false,
    decisionMakerIdentified: false,
    totalTasksForStage: tasks.length,
    completedTasksForStage: tasks.filter((t) => t.status === 'completed').length,
    overdueTaskCount: tasks.filter(
      (t) => t.status !== 'completed' && t.due_date && new Date(t.due_date) < now,
    ).length,
  };

  const result = DealHealthCalculator.calculateDealHealth(healthInput, undefined, nowIso);

  return JSON.stringify({
    dealId: deal.id,
    overallScore: result.overallScore,
    grade: result.grade,
    components: result.components,
    recommendations: result.recommendations,
  });
}

export async function getSubscriptionStatus(supabase: SupabaseClient): Promise<string> {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, office_id')
    .single();

  if (userError || !user) {
    return JSON.stringify({ error: 'Could not determine user office' });
  }

  const { data: sub, error: subError } = await supabase
    .from('subscriptions')
    .select('id, tier, status, product_scope, seat_count, current_period_start, current_period_end, cancel_at_period_end')
    .eq('office_id', user.office_id)
    .single();

  if (subError) {
    return JSON.stringify({
      tier: 'free',
      status: 'active',
      message: 'No subscription found — using free tier',
    });
  }

  return JSON.stringify(sub);
}
