'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth, usePortalClient } from './use-auth';

const supabase = createClient();

export interface PortalDocument {
  id: string;
  name: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  category: string;
  uploaded_by: string;
  created_at: string;
}

export function useDocuments() {
  const { user } = useAuth();
  const { data: portalClient } = usePortalClient();

  return useQuery({
    queryKey: ['portal-documents', portalClient?.contact_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('id, name, file_path, mime_type, size_bytes, category, uploaded_by, created_at')
        .eq('contact_id', portalClient!.contact_id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PortalDocument[];
    },
    enabled: !!user?.id && !!portalClient?.contact_id,
  });
}

interface UploadDocumentParams {
  file: File;
  category: string;
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  const { data: portalClient } = usePortalClient();

  return useMutation({
    mutationFn: async ({ file, category }: UploadDocumentParams) => {
      const contactId = portalClient!.contact_id;

      // 1. Get signed upload URL
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `documents/${contactId}/${timestamp}_${safeName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 2. Create document metadata record
      const { data, error } = await supabase
        .from('documents')
        .insert({
          name: file.name,
          file_path: uploadData.path,
          mime_type: file.type,
          size_bytes: file.size,
          category,
          contact_id: contactId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-documents'] });
      queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] });
    },
  });
}

export function useDownloadDocument() {
  return useMutation({
    mutationFn: async (filePath: string) => {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 3600);

      if (error) throw error;
      return data.signedUrl;
    },
  });
}
