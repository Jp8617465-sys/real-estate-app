import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { storageGet, storageSet, StorageKeys } from '../lib/offline-storage';
import { enqueue, subscribeSyncQueue, type SyncQueueStatus } from '../lib/sync-queue';
import { useNetworkStatus } from './useNetworkStatus';
import type { Contact, CreateContact, UpdateContact, ContactSearch } from '@realflow/shared';

// ─── Types ─────────────────────────────────────────────────────────

interface UseOfflineContactsResult {
  /** List of contacts (from cache or server) */
  contacts: Contact[];
  /** Whether contacts are being loaded */
  isLoading: boolean;
  /** Whether the displayed data is from cache */
  isStale: boolean;
  /** Error from the last fetch attempt */
  error: Error | null;
  /** ISO timestamp of last successful sync */
  lastSyncedAt: string | null;
  /** Create a new contact (works offline) */
  createContact: (data: CreateContact) => Promise<Contact>;
  /** Update an existing contact (works offline) */
  updateContact: (id: string, data: UpdateContact) => Promise<Contact>;
  /** Manually refresh contacts from the server */
  refresh: () => Promise<void>;
}

// ─── Constants ─────────────────────────────────────────────────────

const CONTACTS_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ─── Helpers ───────────────────────────────────────────────────────

function generateTempId(): string {
  const hex = '0123456789abcdef';
  let id = 'temp_';
  for (let i = 0; i < 32; i++) {
    id += hex[Math.floor(Math.random() * 16)];
  }
  return id;
}

/**
 * Map camelCase CreateContact fields to snake_case database columns.
 */
function mapContactToDbRow(
  contact: CreateContact,
): Record<string, unknown> {
  return {
    types: contact.types,
    first_name: contact.firstName,
    last_name: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    secondary_phone: contact.secondaryPhone,
    source: contact.source,
    source_detail: contact.sourceDetail,
    assigned_agent_id: contact.assignedAgentId,
    buyer_profile: contact.buyerProfile,
    seller_profile: contact.sellerProfile,
    tags: contact.tags ?? [],
    communication_preference: contact.communicationPreference,
  };
}

/**
 * Map camelCase UpdateContact fields to snake_case database columns.
 */
function mapUpdateToDbRow(
  updates: UpdateContact,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (updates.types) payload.types = updates.types;
  if (updates.firstName) payload.first_name = updates.firstName;
  if (updates.lastName) payload.last_name = updates.lastName;
  if (updates.email !== undefined) payload.email = updates.email;
  if (updates.phone) payload.phone = updates.phone;
  if (updates.secondaryPhone !== undefined) payload.secondary_phone = updates.secondaryPhone;
  if (updates.source) payload.source = updates.source;
  if (updates.sourceDetail !== undefined) payload.source_detail = updates.sourceDetail;
  if (updates.assignedAgentId) payload.assigned_agent_id = updates.assignedAgentId;
  if (updates.buyerProfile) payload.buyer_profile = updates.buyerProfile;
  if (updates.sellerProfile) payload.seller_profile = updates.sellerProfile;
  if (updates.tags) payload.tags = updates.tags;
  if (updates.communicationPreference) payload.communication_preference = updates.communicationPreference;
  if (updates.nextFollowUp !== undefined) payload.next_follow_up = updates.nextFollowUp;
  return payload;
}

// ─── Hook ──────────────────────────────────────────────────────────

export function useOfflineContacts(
  userId: string,
  search?: ContactSearch,
): UseOfflineContactsResult {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const mountedRef = useRef(true);

  const cacheKey = StorageKeys.contacts(userId);

  // ─── Load cached contacts on mount ─────────────────────────────
  useEffect(() => {
    void loadCachedContacts();
  }, [userId]);

  async function loadCachedContacts(): Promise<void> {
    const cached = await storageGet<Contact[]>(cacheKey);
    if (cached && mountedRef.current) {
      setContacts(applySearchFilter(cached, search));
      setIsStale(true);
      setIsLoading(false);
    }
  }

  // ─── Fetch from server when online ─────────────────────────────
  const fetchFromServer = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) return;
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('contacts')
        .select('*')
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });

      if (search?.types?.length) {
        query = query.overlaps('types', search.types);
      }
      if (search?.assignedAgentId) {
        query = query.eq('assigned_agent_id', search.assignedAgentId);
      }
      if (search?.sources?.length) {
        query = query.in('source', search.sources);
      }
      if (search?.tags?.length) {
        query = query.overlaps('tags', search.tags);
      }
      if (search?.query) {
        query = query.or(
          `first_name.ilike.%${search.query}%,last_name.ilike.%${search.query}%,email.ilike.%${search.query}%,phone.ilike.%${search.query}%`,
        );
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw new Error(fetchError.message);

      const serverContacts = data as Contact[];

      if (!mountedRef.current) return;

      // Merge: keep any locally-created contacts (temp IDs) that haven't synced yet
      const cachedContacts = await storageGet<Contact[]>(cacheKey);
      const tempContacts = (cachedContacts ?? []).filter(
        (c) => typeof c.id === 'string' && c.id.startsWith('temp_'),
      );

      const merged = [...tempContacts, ...serverContacts];

      setContacts(merged);
      setIsStale(false);
      setLastSyncedAt(new Date().toISOString());

      // Persist full list to cache
      await storageSet(cacheKey, merged, CONTACTS_TTL_MS);

      // Also update the React Query cache so other hooks stay in sync
      queryClient.setQueryData(['contacts', search], serverContacts);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err : new Error('Failed to fetch contacts'));
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [cacheKey, search, queryClient]);

  useEffect(() => {
    if (isOnline) {
      void fetchFromServer();
    }
  }, [isOnline, fetchFromServer]);

  // ─── Listen for sync queue changes to refresh after sync ───────
  useEffect(() => {
    const unsubscribe = subscribeSyncQueue((status: SyncQueueStatus) => {
      // When queue finishes processing and we're online, refresh
      if (!status.isProcessing && status.pendingCount === 0 && isOnline) {
        void fetchFromServer();
      }
    });
    return unsubscribe;
  }, [isOnline, fetchFromServer]);

  // ─── Create contact (works offline) ────────────────────────────
  const createContact = useCallback(
    async (data: CreateContact): Promise<Contact> => {
      const tempId = generateTempId();
      const now = new Date().toISOString();

      // Build optimistic local contact
      const optimisticContact: Contact = {
        id: tempId,
        types: data.types,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        secondaryPhone: data.secondaryPhone,
        address: data.address,
        source: data.source,
        sourceDetail: data.sourceDetail,
        assignedAgentId: data.assignedAgentId,
        buyerProfile: data.buyerProfile,
        sellerProfile: data.sellerProfile,
        tags: data.tags ?? [],
        communicationPreference: data.communicationPreference ?? 'any',
        socialProfiles: data.socialProfiles,
        createdAt: now,
        updatedAt: now,
      };

      // Optimistic update: add to local state immediately
      setContacts((prev) => [optimisticContact, ...prev]);

      // Persist to cache
      const cached = await storageGet<Contact[]>(cacheKey) ?? [];
      await storageSet(cacheKey, [optimisticContact, ...cached], CONTACTS_TTL_MS);

      // Queue for sync
      const dbRow = mapContactToDbRow(data);
      await enqueue('create', 'contacts', { ...dbRow, id: tempId }, tempId);

      // If online, try to sync immediately
      if (isOnline) {
        try {
          const { data: serverData, error: createError } = await supabase
            .from('contacts')
            .insert(dbRow)
            .select()
            .single();

          if (createError) throw new Error(createError.message);

          const serverContact = serverData as Contact;

          // Replace temp contact with server contact
          setContacts((prev) =>
            prev.map((c) => (c.id === tempId ? serverContact : c)),
          );

          // Update cache
          const currentCache = await storageGet<Contact[]>(cacheKey) ?? [];
          await storageSet(
            cacheKey,
            currentCache.map((c) => (c.id === tempId ? serverContact : c)),
            CONTACTS_TTL_MS,
          );

          queryClient.invalidateQueries({ queryKey: ['contacts'] });
          return serverContact;
        } catch {
          // Failed to sync immediately, the queue will handle it later
        }
      }

      return optimisticContact;
    },
    [cacheKey, isOnline, queryClient],
  );

  // ─── Update contact (works offline) ────────────────────────────
  const updateContact = useCallback(
    async (id: string, data: UpdateContact): Promise<Contact> => {
      const now = new Date().toISOString();

      // Optimistic update: apply changes to local state immediately
      let updatedContact: Contact | null = null;

      setContacts((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;

          const updated: Contact = {
            ...c,
            ...(data.types && { types: data.types }),
            ...(data.firstName && { firstName: data.firstName }),
            ...(data.lastName && { lastName: data.lastName }),
            ...(data.email !== undefined && { email: data.email }),
            ...(data.phone && { phone: data.phone }),
            ...(data.secondaryPhone !== undefined && {
              secondaryPhone: data.secondaryPhone,
            }),
            ...(data.source && { source: data.source }),
            ...(data.sourceDetail !== undefined && {
              sourceDetail: data.sourceDetail,
            }),
            ...(data.assignedAgentId && {
              assignedAgentId: data.assignedAgentId,
            }),
            ...(data.buyerProfile && { buyerProfile: data.buyerProfile }),
            ...(data.sellerProfile && { sellerProfile: data.sellerProfile }),
            ...(data.tags && { tags: data.tags }),
            ...(data.communicationPreference && {
              communicationPreference: data.communicationPreference,
            }),
            ...(data.nextFollowUp !== undefined && {
              nextFollowUp: data.nextFollowUp,
            }),
            updatedAt: now,
          };
          updatedContact = updated;
          return updated;
        }),
      );

      if (!updatedContact) {
        throw new Error(`Contact with id ${id} not found in local state`);
      }

      // Persist to cache
      const cached = await storageGet<Contact[]>(cacheKey) ?? [];
      await storageSet(
        cacheKey,
        cached.map((c) => (c.id === id ? updatedContact : c)),
        CONTACTS_TTL_MS,
      );

      // Queue for sync
      const dbRow = mapUpdateToDbRow(data);
      await enqueue('update', 'contacts', dbRow, id);

      // If online, try to sync immediately
      if (isOnline && !id.startsWith('temp_')) {
        try {
          const { data: serverData, error: updateError } = await supabase
            .from('contacts')
            .update(dbRow)
            .eq('id', id)
            .select()
            .single();

          if (updateError) throw new Error(updateError.message);

          const serverContact = serverData as Contact;

          setContacts((prev) =>
            prev.map((c) => (c.id === id ? serverContact : c)),
          );

          const currentCache = await storageGet<Contact[]>(cacheKey) ?? [];
          await storageSet(
            cacheKey,
            currentCache.map((c) => (c.id === id ? serverContact : c)),
            CONTACTS_TTL_MS,
          );

          queryClient.invalidateQueries({ queryKey: ['contacts'] });
          queryClient.invalidateQueries({ queryKey: ['contacts', id] });
          return serverContact;
        } catch {
          // Failed to sync immediately, the queue will handle it later
        }
      }

      return updatedContact;
    },
    [cacheKey, isOnline, queryClient],
  );

  // ─── Refresh ───────────────────────────────────────────────────
  const refresh = useCallback(async (): Promise<void> => {
    if (isOnline) {
      await fetchFromServer();
    }
  }, [isOnline, fetchFromServer]);

  // ─── Cleanup ───────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    contacts,
    isLoading,
    isStale,
    error,
    lastSyncedAt,
    createContact,
    updateContact,
    refresh,
  };
}

// ─── Local Filter Helper ───────────────────────────────────────────

function applySearchFilter(
  contacts: Contact[],
  search?: ContactSearch,
): Contact[] {
  if (!search) return contacts;

  let filtered = contacts;

  if (search.types?.length) {
    filtered = filtered.filter((c) =>
      c.types.some((t) => search.types?.includes(t)),
    );
  }

  if (search.assignedAgentId) {
    filtered = filtered.filter(
      (c) => c.assignedAgentId === search.assignedAgentId,
    );
  }

  if (search.sources?.length) {
    filtered = filtered.filter((c) => search.sources?.includes(c.source));
  }

  if (search.tags?.length) {
    filtered = filtered.filter((c) =>
      c.tags.some((t) => search.tags?.includes(t)),
    );
  }

  if (search.query) {
    const q = search.query.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q),
    );
  }

  return filtered;
}
