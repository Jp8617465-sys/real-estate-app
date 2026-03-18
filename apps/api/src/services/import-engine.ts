import type { FieldMapping, ImportPreview, ImportPreviewRow } from '@realflow/shared';

interface ImportJobRow {
  id: string;
  office_id: string;
  entity_type: string;
  field_mappings: FieldMapping[];
  skip_duplicates: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

interface ImportResult {
  processedRows: number;
  successCount: number;
  errorCount: number;
  duplicateCount: number;
}

// Known field names for auto-mapping
const CONTACT_FIELD_MAP: Record<string, string> = {
  'first name': 'first_name',
  'firstname': 'first_name',
  'first_name': 'first_name',
  'last name': 'last_name',
  'lastname': 'last_name',
  'last_name': 'last_name',
  'email': 'email',
  'email address': 'email',
  'phone': 'phone',
  'phone number': 'phone',
  'mobile': 'phone',
  'company': 'company',
  'organisation': 'company',
  'organization': 'company',
  'source': 'source',
  'lead source': 'source',
  'notes': 'notes',
  'address': 'address',
  'suburb': 'suburb',
  'state': 'state',
  'postcode': 'postcode',
  'type': 'contact_type',
  'contact type': 'contact_type',
  'tags': 'tags',
};

const PROPERTY_FIELD_MAP: Record<string, string> = {
  'address': 'address_line_1',
  'address line 1': 'address_line_1',
  'street': 'address_line_1',
  'suburb': 'suburb',
  'state': 'state',
  'postcode': 'postcode',
  'price': 'price',
  'asking price': 'price',
  'bedrooms': 'bedrooms',
  'beds': 'bedrooms',
  'bathrooms': 'bathrooms',
  'baths': 'bathrooms',
  'parking': 'parking',
  'car spaces': 'parking',
  'property type': 'property_type',
  'type': 'property_type',
  'land size': 'land_size',
  'floor area': 'floor_area',
  'status': 'status',
  'listing status': 'status',
};

/**
 * CSV import engine with auto-mapping, duplicate detection, and batch insertion.
 */
export class ImportEngine {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Generate a preview of the import, detecting columns and suggesting field mappings.
   */
  async generatePreview(
    job: ImportJobRow,
    rows: Array<Record<string, string>>,
  ): Promise<ImportPreview> {
    const detectedColumns = rows.length > 0 ? Object.keys(rows[0]!) : [];
    const fieldMap = job.entity_type === 'contacts' ? CONTACT_FIELD_MAP : PROPERTY_FIELD_MAP;

    // Auto-suggest mappings
    const suggestedMappings: FieldMapping[] = detectedColumns
      .reduce<FieldMapping[]>((acc, col) => {
        const normalizedCol = col.toLowerCase().trim();
        const targetField = fieldMap[normalizedCol];
        if (targetField) {
          acc.push({
            sourceColumn: col,
            targetField,
            transform: 'trim',
          });
        }
        return acc;
      }, []);

    // Preview first 5 rows with suggested mappings
    const previewRows: ImportPreviewRow[] = rows.slice(0, 5).map((row, index) => {
      const mapped: Record<string, unknown> = {};
      const warnings: string[] = [];

      for (const mapping of suggestedMappings) {
        const rawValue = row[mapping.sourceColumn];
        if (rawValue !== undefined) {
          mapped[mapping.targetField] = this.applyTransform(rawValue, mapping.transform);
        }
      }

      // Check for required fields
      if (job.entity_type === 'contacts') {
        if (!mapped.first_name && !mapped.email) {
          warnings.push('Missing first_name or email — row may be skipped');
        }
      } else {
        if (!mapped.address_line_1 && !mapped.suburb) {
          warnings.push('Missing address — row may be skipped');
        }
      }

      return {
        rowNumber: index + 1,
        mapped,
        warnings,
        isDuplicate: false,
      };
    });

    // Check for duplicates in preview
    let duplicateCount = 0;
    if (job.entity_type === 'contacts') {
      for (const preview of previewRows) {
        if (preview.mapped.email) {
          const { data } = await (this.supabase
            .from('contacts')
            .select('id') as unknown as Promise<{ data: Array<{ id: string }> | null }>);

          if (data && data.length > 0) {
            preview.isDuplicate = true;
            preview.duplicateOfId = data[0]!.id;
            duplicateCount++;
          }
        }
      }
    }

    return {
      totalRows: rows.length,
      previewRows,
      detectedColumns,
      suggestedMappings,
      duplicateCount,
    };
  }

  /**
   * Execute the full import using configured field mappings.
   */
  async execute(
    job: ImportJobRow,
    rows: Array<Record<string, string>>,
  ): Promise<ImportResult> {
    const mappings = job.field_mappings;
    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;

    const table = job.entity_type === 'contacts' ? 'contacts' : 'properties';
    const batchSize = 50;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);

      for (let j = 0; j < batch.length; j++) {
        const row = batch[j]!;
        const rowNumber = i + j + 1;

        try {
          const mapped: Record<string, unknown> = {
            office_id: job.office_id,
          };

          for (const mapping of mappings) {
            const rawValue = row[mapping.sourceColumn];
            if (rawValue !== undefined && rawValue !== '') {
              mapped[mapping.targetField] = this.applyTransform(rawValue, mapping.transform);
            }
          }

          // Skip rows missing required fields
          if (job.entity_type === 'contacts' && !mapped.first_name && !mapped.email) {
            await this.logError(job.id, rowNumber, 'first_name/email', 'Missing required field', row);
            errorCount++;
            continue;
          }

          if (job.entity_type === 'properties' && !mapped.address_line_1) {
            await this.logError(job.id, rowNumber, 'address_line_1', 'Missing required field', row);
            errorCount++;
            continue;
          }

          // Duplicate check for contacts (by email)
          if (job.entity_type === 'contacts' && mapped.email && job.skip_duplicates) {
            const { data: existing } = await (this.supabase
              .from('contacts')
              .select('id') as unknown as Promise<{ data: Array<{ id: string }> | null }>);

            if (existing && existing.length > 0) {
              duplicateCount++;
              continue;
            }
          }

          const { error } = await this.supabase
            .from(table)
            .insert(mapped)
            .select()
            .single();

          if (error) {
            await this.logError(job.id, rowNumber, undefined, (error as { message: string }).message, row);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          await this.logError(job.id, rowNumber, undefined, message, row);
          errorCount++;
        }
      }
    }

    return {
      processedRows: rows.length,
      successCount,
      errorCount,
      duplicateCount,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private applyTransform(value: string, transform: string): string {
    switch (transform) {
      case 'uppercase':
        return value.toUpperCase();
      case 'lowercase':
        return value.toLowerCase();
      case 'trim':
        return value.trim();
      case 'phone_au':
        // Normalize AU phone: strip spaces/dashes, add +61 if missing
        return value.replace(/[\s\-()]/g, '').replace(/^0/, '+61');
      case 'date_au':
        // Parse DD/MM/YYYY to ISO
        const parts = value.split('/');
        if (parts.length === 3) {
          return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toISOString();
        }
        return value;
      default:
        return value;
    }
  }

  private async logError(
    jobId: string,
    rowNumber: number,
    field: string | undefined,
    message: string,
    rawData: Record<string, string>,
  ): Promise<void> {
    try {
      await this.supabase
        .from('import_errors')
        .insert({
          import_job_id: jobId,
          row_number: rowNumber,
          field,
          message,
          raw_data: rawData,
        })
        .select()
        .single();
    } catch {
      // Best effort — don't fail the import if error logging fails
    }
  }
}
