import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportEngine } from './import-engine';

// ─── Mock Supabase ─────────────────────────────────────────────────

function createMockSupabase(options?: { insertError?: boolean; selectData?: unknown[] }) {
  const mockInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue(
        options?.insertError
          ? { data: null, error: { message: 'Insert failed' } }
          : { data: { id: 'new-1' }, error: null },
      ),
    }),
  });

  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: options?.selectData ?? [],
        error: null,
      }),
      insert: mockInsert,
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  };
}

describe('ImportEngine', () => {
  describe('generatePreview', () => {
    it('detects columns from CSV rows', async () => {
      const supabase = createMockSupabase();
      const engine = new ImportEngine(supabase);

      const result = await engine.generatePreview(
        {
          id: 'job-1',
          office_id: 'office-1',
          entity_type: 'contacts',
          field_mappings: [],
          skip_duplicates: true,
        },
        [
          { 'First Name': 'John', 'Last Name': 'Smith', 'Email': 'john@test.com' },
          { 'First Name': 'Jane', 'Last Name': 'Doe', 'Email': 'jane@test.com' },
        ],
      );

      expect(result.detectedColumns).toEqual(['First Name', 'Last Name', 'Email']);
      expect(result.totalRows).toBe(2);
    });

    it('auto-suggests field mappings for contacts', async () => {
      const supabase = createMockSupabase();
      const engine = new ImportEngine(supabase);

      const result = await engine.generatePreview(
        {
          id: 'job-1',
          office_id: 'office-1',
          entity_type: 'contacts',
          field_mappings: [],
          skip_duplicates: true,
        },
        [{ 'First Name': 'John', 'Email': 'john@test.com', 'Phone': '0412345678' }],
      );

      const mappedFields = result.suggestedMappings.map(m => m.targetField);
      expect(mappedFields).toContain('first_name');
      expect(mappedFields).toContain('email');
      expect(mappedFields).toContain('phone');
    });

    it('auto-suggests field mappings for properties', async () => {
      const supabase = createMockSupabase();
      const engine = new ImportEngine(supabase);

      const result = await engine.generatePreview(
        {
          id: 'job-1',
          office_id: 'office-1',
          entity_type: 'properties',
          field_mappings: [],
          skip_duplicates: true,
        },
        [{ 'Address': '42 Smith St', 'Suburb': 'Paddington', 'Bedrooms': '3', 'Price': '1500000' }],
      );

      const mappedFields = result.suggestedMappings.map(m => m.targetField);
      expect(mappedFields).toContain('address_line_1');
      expect(mappedFields).toContain('suburb');
      expect(mappedFields).toContain('bedrooms');
    });

    it('limits preview to 5 rows', async () => {
      const supabase = createMockSupabase();
      const engine = new ImportEngine(supabase);

      const rows = Array.from({ length: 20 }, (_, i) => ({
        'First Name': `User ${i}`,
        'Email': `user${i}@test.com`,
      }));

      const result = await engine.generatePreview(
        { id: 'job-1', office_id: 'office-1', entity_type: 'contacts', field_mappings: [], skip_duplicates: true },
        rows,
      );

      expect(result.previewRows).toHaveLength(5);
      expect(result.totalRows).toBe(20);
    });
  });

  describe('execute', () => {
    it('imports valid contact rows', async () => {
      const supabase = createMockSupabase();
      const engine = new ImportEngine(supabase);

      const result = await engine.execute(
        {
          id: 'job-1',
          office_id: 'office-1',
          entity_type: 'contacts',
          field_mappings: [
            { sourceColumn: 'First Name', targetField: 'first_name', transform: 'trim' },
            { sourceColumn: 'Email', targetField: 'email', transform: 'lowercase' },
          ],
          skip_duplicates: true,
        },
        [
          { 'First Name': 'John', 'Email': 'JOHN@TEST.COM' },
          { 'First Name': 'Jane', 'Email': 'JANE@TEST.COM' },
        ],
      );

      expect(result.processedRows).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
    });

    it('skips rows missing required fields', async () => {
      const supabase = createMockSupabase();
      const engine = new ImportEngine(supabase);

      const result = await engine.execute(
        {
          id: 'job-1',
          office_id: 'office-1',
          entity_type: 'contacts',
          field_mappings: [
            { sourceColumn: 'Notes', targetField: 'notes', transform: 'none' },
          ],
          skip_duplicates: true,
        },
        [{ 'Notes': 'Some notes but no name or email' }],
      );

      expect(result.errorCount).toBe(1);
      expect(result.successCount).toBe(0);
    });

    it('handles insert errors gracefully', async () => {
      const supabase = createMockSupabase({ insertError: true });
      const engine = new ImportEngine(supabase);

      const result = await engine.execute(
        {
          id: 'job-1',
          office_id: 'office-1',
          entity_type: 'contacts',
          field_mappings: [
            { sourceColumn: 'First Name', targetField: 'first_name', transform: 'trim' },
          ],
          skip_duplicates: true,
        },
        [{ 'First Name': 'John' }],
      );

      expect(result.errorCount).toBe(1);
    });
  });

  describe('transforms', () => {
    it('applies phone_au transform', async () => {
      const supabase = createMockSupabase();
      const engine = new ImportEngine(supabase);

      const result = await engine.execute(
        {
          id: 'job-1',
          office_id: 'office-1',
          entity_type: 'contacts',
          field_mappings: [
            { sourceColumn: 'First Name', targetField: 'first_name', transform: 'trim' },
            { sourceColumn: 'Phone', targetField: 'phone', transform: 'phone_au' },
          ],
          skip_duplicates: true,
        },
        [{ 'First Name': 'John', 'Phone': '0412 345 678' }],
      );

      expect(result.successCount).toBe(1);
      // The phone should be transformed to +61412345678 internally
    });
  });
});
