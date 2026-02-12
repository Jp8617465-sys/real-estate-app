/**
 * RealFlow: Pipeline Migration API Routes
 *
 * This module provides HTTP endpoints for migrating transactions from the legacy
 * 'buying' pipeline to the new 'buyers-agent' pipeline with full audit trail.
 *
 * Routes:
 * - POST /api/v1/pipeline-migration/preview - Dry-run preview of migration decisions
 * - POST /api/v1/pipeline-migration/execute - Execute migration with brief creation
 * - GET /api/v1/pipeline-migration/history - View migration history (last 100)
 * - POST /api/v1/pipeline-migration/rollback - Rollback a migration batch
 *
 * Features:
 * - Intelligent stage mapping using PipelineMigrationEngine business logic
 * - Automatic client brief generation from buyer profiles when needed
 * - Batch operations with UUID tracking for grouping related migrations
 * - Full audit trail in pipeline_migration_history table
 * - Rollback support to restore original pipeline state
 * - Confidence scoring (high/medium/low) for each migration decision
 * - Detailed warnings for incomplete data or edge cases
 *
 * @see packages/business-logic/src/pipeline-migration.ts for stage mapping logic
 * @see supabase/migrations/00006_pipeline_migration_tracking.sql for schema
 * @see supabase/migrations/00007_pipeline_migration_function.sql for SQL function
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  PipelineMigrationEngine,
  type MigrationContext,
  type MigrationDecision,
} from '@realflow/business-logic';
import { createSupabaseClient } from '../middleware/supabase';
import type { BuyerProfile } from '@realflow/shared';

// ─── Request Schemas ────────────────────────────────────────────────

const PreviewMigrationSchema = z.object({
  transactionIds: z.array(z.string().uuid()).optional(),
  dryRun: z.boolean().default(true),
});

const ExecuteMigrationSchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1, 'At least one transaction ID is required'),
  userId: z.string().uuid(),
  reason: z.string().optional(),
});

const RollbackMigrationSchema = z.object({
  migrationBatchId: z.string().uuid(),
  userId: z.string().uuid(),
  reason: z.string(),
});

// ─── Response Types ─────────────────────────────────────────────────

interface MigrationPreview {
  transactionId: string;
  contactId: string;
  currentStage: string;
  targetStage: string;
  requiresBriefCreation: boolean;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

interface MigrationResult {
  transactionId: string;
  success: boolean;
  targetStage?: string;
  briefCreated?: boolean;
  clientBriefId?: string;
  error?: string;
}

// ─── Helper Functions ───────────────────────────────────────────────

/**
 * Fetch transaction data with all related entities needed for migration decision.
 * Returns MigrationContext or null if transaction not found.
 */
async function fetchMigrationContext(
  supabase: ReturnType<typeof createSupabaseClient>,
  transactionId: string,
): Promise<MigrationContext | null> {
  // Fetch transaction with related data
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .select(
      `
      id,
      contact_id,
      current_stage,
      property_id,
      contacts!inner (
        buyer_profile
      )
    `,
    )
    .eq('id', transactionId)
    .eq('pipeline_type', 'buying')
    .eq('is_deleted', false)
    .single();

  if (txError || !transaction) {
    return null;
  }

  // Fetch client brief
  const { data: clientBrief } = await supabase
    .from('client_briefs')
    .select('id, client_signed_off')
    .eq('transaction_id', transactionId)
    .eq('is_deleted', false)
    .maybeSingle();

  // Fetch offers
  const { data: offers } = await supabase
    .from('offers')
    .select('id, status')
    .eq('transaction_id', transactionId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(1);

  const latestOffer = offers?.[0];

  // Fetch contracts
  const { data: contracts } = await supabase
    .from('contracts')
    .select('id, contract_price, exchange_date, settlement_date, status')
    .eq('transaction_id', transactionId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(1);

  const latestContract = contracts?.[0];

  // Fetch fee structures for retainer info
  const { data: feeStructures } = await supabase
    .from('fee_structures')
    .select('retainer_paid_date')
    .eq('transaction_id', transactionId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(1);

  const feeStructure = feeStructures?.[0];

  // Build migration context
  const context: MigrationContext = {
    transactionId: transaction.id,
    contactId: transaction.contact_id,
    currentStage: transaction.current_stage as any,

    // Client brief
    hasClientBrief: !!clientBrief,
    clientBriefId: clientBrief?.id,
    briefIsSigned: clientBrief?.client_signed_off ?? false,

    // Property
    hasProperty: !!transaction.property_id,
    propertyId: transaction.property_id ?? undefined,

    // Offer
    hasOffer: !!latestOffer,
    offerStatus: latestOffer?.status as any,

    // Contract
    hasContract: !!latestContract,
    contractPrice: latestContract?.contract_price,
    exchangeDate: latestContract?.exchange_date,
    settlementDate: latestContract?.settlement_date,
    isSettled: latestContract?.status === 'settled',

    // Retainer
    hasRetainerPaid: !!feeStructure?.retainer_paid_date,
    retainerPaidDate: feeStructure?.retainer_paid_date,

    // Buyer profile from contact JSONB
    buyerProfile: (transaction.contacts as any)?.buyer_profile as BuyerProfile | undefined,
  };

  return context;
}

// ─── Route Handlers ─────────────────────────────────────────────────

export async function pipelineMigrationRoutes(fastify: FastifyInstance) {
  /**
   * Route 1: Preview Migration
   * POST /api/pipeline-migration/preview
   *
   * Dry-run preview showing migration decisions for transactions without making changes.
   */
  fastify.post('/preview', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = PreviewMigrationSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { transactionIds, dryRun } = parsed.data;

    try {
      // Determine which transactions to process
      let targetTransactionIds: string[];

      if (transactionIds && transactionIds.length > 0) {
        targetTransactionIds = transactionIds;
      } else {
        // Fetch all buying pipeline transactions
        const { data: transactions, error: listError } = await supabase
          .from('transactions')
          .select('id')
          .eq('pipeline_type', 'buying')
          .eq('is_deleted', false);

        if (listError) {
          return reply.status(500).send({ error: listError.message });
        }

        targetTransactionIds = transactions?.map((t) => t.id) ?? [];
      }

      // Process each transaction
      const previews: MigrationPreview[] = [];
      const stats = {
        high: 0,
        medium: 0,
        low: 0,
        requiresBriefCreation: 0,
      };

      for (const txId of targetTransactionIds) {
        const context = await fetchMigrationContext(supabase, txId);

        if (!context) {
          // Transaction not found or not eligible
          continue;
        }

        const decision: MigrationDecision =
          PipelineMigrationEngine.determineTargetStage(context);

        previews.push({
          transactionId: context.transactionId,
          contactId: context.contactId,
          currentStage: context.currentStage,
          targetStage: decision.targetStage,
          requiresBriefCreation: decision.requiresBriefCreation,
          reason: decision.reason,
          confidence: decision.confidence,
          warnings: decision.warnings,
        });

        // Update stats
        stats[decision.confidence]++;
        if (decision.requiresBriefCreation) {
          stats.requiresBriefCreation++;
        }
      }

      return {
        dryRun,
        totalTransactions: previews.length,
        byConfidence: stats,
        requiresBriefCreation: stats.requiresBriefCreation,
        previews,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Preview migration failed',
      });
    }
  });

  /**
   * Route 2: Execute Migration
   * POST /api/pipeline-migration/execute
   *
   * Execute migration for specified transactions with full audit trail.
   */
  fastify.post('/execute', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = ExecuteMigrationSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { transactionIds, userId, reason } = parsed.data;

    try {
      // Generate migration batch ID for tracking
      const migrationBatchId = crypto.randomUUID();

      const results: MigrationResult[] = [];
      const errors: Array<{ transactionId: string; error: string }> = [];

      for (const txId of transactionIds) {
        try {
          // Fetch migration context
          const context = await fetchMigrationContext(supabase, txId);

          if (!context) {
            errors.push({
              transactionId: txId,
              error: 'Transaction not found or not eligible for migration',
            });
            continue;
          }

          // Get migration decision
          const decision: MigrationDecision =
            PipelineMigrationEngine.determineTargetStage(context);

          let clientBriefId: string | undefined = context.clientBriefId;

          // Create client brief if needed
          if (decision.requiresBriefCreation && context.buyerProfile) {
            const briefData = PipelineMigrationEngine.generateBriefFromBuyerProfile(
              context.contactId,
              context.transactionId,
              context.buyerProfile,
              userId,
            );

            const { data: newBrief, error: briefError } = await supabase
              .from('client_briefs')
              .insert(briefData)
              .select('id')
              .single();

            if (briefError) {
              errors.push({
                transactionId: txId,
                error: `Failed to create client brief: ${briefError.message}`,
              });
              continue;
            }

            clientBriefId = newBrief.id;
          }

          // Call SQL migration function
          const { data: migrationResult, error: migrationError } = await supabase.rpc(
            'migrate_transaction_to_buyers_agent',
            {
              p_transaction_id: txId,
              p_target_stage: decision.targetStage,
              p_client_brief_id: clientBriefId ?? null,
              p_migration_batch_id: migrationBatchId,
              p_migration_reason: reason ?? decision.reason,
              p_migration_context: {
                confidence: decision.confidence,
                warnings: decision.warnings,
                requiresBriefCreation: decision.requiresBriefCreation,
                briefCreated: !!clientBriefId,
              },
              p_migrated_by: userId,
            },
          );

          if (migrationError) {
            errors.push({
              transactionId: txId,
              error: migrationError.message,
            });
            continue;
          }

          // Check if migration was successful
          const result = migrationResult as any;
          if (result.success) {
            results.push({
              transactionId: txId,
              success: true,
              targetStage: decision.targetStage,
              briefCreated: decision.requiresBriefCreation && !!clientBriefId,
              clientBriefId,
            });
          } else {
            errors.push({
              transactionId: txId,
              error: result.error || 'Migration function returned failure',
            });
          }
        } catch (error) {
          errors.push({
            transactionId: txId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        migrationBatchId,
        totalRequested: transactionIds.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Execute migration failed',
      });
    }
  });

  /**
   * Route 3: Migration History
   * GET /api/pipeline-migration/history
   *
   * View migration history (last 100 records).
   */
  fastify.get('/history', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    try {
      const { data, error } = await supabase
        .from('pipeline_migration_history')
        .select(
          `
          id,
          transaction_id,
          original_pipeline_type,
          original_stage,
          new_pipeline_type,
          new_stage,
          client_brief_created,
          client_brief_id,
          migration_batch_id,
          migration_reason,
          migrated_by,
          migrated_at,
          users!pipeline_migration_history_migrated_by_fkey (
            id,
            full_name
          )
        `,
        )
        .eq('rolled_back', false)
        .order('migrated_at', { ascending: false })
        .limit(100);

      if (error) {
        return reply.status(500).send({ error: error.message });
      }

      // Transform response to flatten user data
      const transformedData = data?.map((record) => ({
        id: record.id,
        transaction_id: record.transaction_id,
        original_pipeline_type: record.original_pipeline_type,
        original_stage: record.original_stage,
        new_pipeline_type: record.new_pipeline_type,
        new_stage: record.new_stage,
        client_brief_created: record.client_brief_created,
        client_brief_id: record.client_brief_id,
        migration_batch_id: record.migration_batch_id,
        migration_reason: record.migration_reason,
        migrated_by_user: (record.users as any)?.full_name || 'Unknown',
        migrated_at: record.migrated_at,
      }));

      return { data: transformedData };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Failed to fetch migration history',
      });
    }
  });

  /**
   * Route 4: Rollback Migration
   * POST /api/pipeline-migration/rollback
   *
   * Rollback a migration batch to restore original pipeline state.
   */
  fastify.post('/rollback', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = RollbackMigrationSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { migrationBatchId, userId, reason } = parsed.data;

    try {
      // Fetch all migrations in this batch
      const { data: migrations, error: fetchError } = await supabase
        .from('pipeline_migration_history')
        .select('*')
        .eq('migration_batch_id', migrationBatchId)
        .eq('rolled_back', false);

      if (fetchError) {
        return reply.status(500).send({ error: fetchError.message });
      }

      if (!migrations || migrations.length === 0) {
        return reply.status(404).send({
          error: 'Migration batch not found or already rolled back',
        });
      }

      const results: Array<{ transactionId: string; success: boolean }> = [];

      for (const migration of migrations) {
        try {
          // Restore transaction to original state
          const { error: updateError } = await supabase
            .from('transactions')
            .update({
              pipeline_type: migration.original_pipeline_type,
              current_stage: migration.original_stage,
              updated_at: new Date().toISOString(),
            })
            .eq('id', migration.transaction_id);

          if (updateError) {
            results.push({
              transactionId: migration.transaction_id,
              success: false,
            });
            continue;
          }

          // Mark migration as rolled back
          const { error: rollbackError } = await supabase
            .from('pipeline_migration_history')
            .update({
              rolled_back: true,
              rollback_reason: reason,
              rolled_back_at: new Date().toISOString(),
            })
            .eq('id', migration.id);

          if (rollbackError) {
            results.push({
              transactionId: migration.transaction_id,
              success: false,
            });
            continue;
          }

          // Create activity log for rollback
          const { data: transaction } = await supabase
            .from('transactions')
            .select('contact_id, property_id')
            .eq('id', migration.transaction_id)
            .single();

          if (transaction) {
            await supabase.from('activities').insert({
              contact_id: transaction.contact_id,
              transaction_id: migration.transaction_id,
              property_id: transaction.property_id ?? null,
              type: 'stage-change',
              title: `Pipeline Rollback: buyers-agent → ${migration.original_pipeline_type}`,
              description: `Transaction rolled back from buyers-agent (${migration.new_stage}) to ${migration.original_pipeline_type} (${migration.original_stage}). Reason: ${reason}`,
              metadata: {
                migration_history_id: migration.id,
                migration_batch_id: migrationBatchId,
                rollback_reason: reason,
              },
              created_by: userId,
              created_at: new Date().toISOString(),
            });
          }

          results.push({
            transactionId: migration.transaction_id,
            success: true,
          });
        } catch (error) {
          results.push({
            transactionId: migration.transaction_id,
            success: false,
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;

      return {
        success: successCount === results.length,
        rolledBack: successCount,
        results,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Rollback migration failed',
      });
    }
  });
}
