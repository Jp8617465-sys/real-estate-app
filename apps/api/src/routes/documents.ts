import type { FastifyInstance } from 'fastify';
import { CreateDocumentSchema } from '@realflow/shared';
import { z } from 'zod';
import { createSupabaseClient } from '../middleware/supabase';

const DocumentFilterSchema = z.object({
  contactId: z.string().uuid().optional(),
  transactionId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  category: z.string().optional(),
});

const UploadUrlSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  contactId: z.string().uuid().optional(),
  transactionId: z.string().uuid().optional(),
});

export async function documentRoutes(fastify: FastifyInstance) {
  // List documents with optional filters
  fastify.get('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const filters = DocumentFilterSchema.parse(request.query);

    let query = supabase
      .from('documents')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (filters.contactId) {
      query = query.eq('contact_id', filters.contactId);
    }
    if (filters.transactionId) {
      query = query.eq('transaction_id', filters.transactionId);
    }
    if (filters.propertyId) {
      query = query.eq('property_id', filters.propertyId);
    }
    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    const { data, error } = await query;
    if (error) return reply.status(500).send({ error: error.message });

    return { data };
  });

  // Get single document
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (error) return reply.status(404).send({ error: 'Document not found' });
    return { data };
  });

  // Create document metadata record
  fastify.post('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = CreateDocumentSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const doc = parsed.data;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('documents')
      .insert({
        name: doc.name,
        file_path: doc.filePath,
        mime_type: doc.mimeType,
        size_bytes: doc.sizeBytes,
        category: doc.category,
        contact_id: doc.contactId,
        transaction_id: doc.transactionId,
        property_id: doc.propertyId,
        uploaded_by: user?.id,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // Generate signed upload URL
  fastify.post('/upload-url', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = UploadUrlSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { fileName, mimeType, contactId, transactionId } = parsed.data;

    // Build a storage path: documents/<contactId or 'general'>/<timestamp>_<fileName>
    const folder = contactId ?? transactionId ?? 'general';
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `documents/${folder}/${timestamp}_${safeName}`;

    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUploadUrl(path);

    if (error) return reply.status(500).send({ error: error.message });

    return {
      signedUrl: data.signedUrl,
      path: data.path,
      token: data.token,
    };
  });

  // Generate signed download URL
  fastify.get<{ Params: { id: string } }>('/:id/download-url', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    // Get the document record to find its file path
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('file_path')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (docError || !doc) {
      return reply.status(404).send({ error: 'Document not found' });
    }

    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 3600);

    if (error) return reply.status(500).send({ error: error.message });

    return { signedUrl: data.signedUrl };
  });

  // Soft delete document
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { error } = await supabase
      .from('documents')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return reply.status(500).send({ error: error.message });
    return { success: true };
  });
}
