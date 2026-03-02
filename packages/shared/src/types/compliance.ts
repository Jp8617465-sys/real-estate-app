import { z } from 'zod';

// ─── Document Types ───────────────────────────────────────────────────────────

export const AmlDocumentTypeSchema = z.enum([
  // Primary — 70 pts
  'passport',
  'birth_certificate',
  'citizenship_certificate',
  // Secondary A — 40 pts
  'drivers_licence',
  'government_id_card',
  'proof_of_age_card',
  // Secondary B — 25 pts
  'medicare_card',
  'credit_card',
  'bank_card',
  // Supporting — 25 pts
  'utility_bill',
  'bank_statement',
  'council_rates',
  'lease_agreement',
  'centrelink_letter',
]);

export const AmlDocumentCategorySchema = z.enum([
  'primary',
  'secondary_a',
  'secondary_b',
  'supporting',
]);

export type AmlDocumentType     = z.infer<typeof AmlDocumentTypeSchema>;
export type AmlDocumentCategory = z.infer<typeof AmlDocumentCategorySchema>;

// Point values are static reference data
export const AML_DOCUMENT_POINTS: Record<AmlDocumentType, number> = {
  passport:                70,
  birth_certificate:       70,
  citizenship_certificate: 70,
  drivers_licence:         40,
  government_id_card:      40,
  proof_of_age_card:       40,
  medicare_card:           25,
  credit_card:             25,
  bank_card:               25,
  utility_bill:            25,
  bank_statement:          25,
  council_rates:           25,
  lease_agreement:         25,
  centrelink_letter:       25,
};

export const AML_DOCUMENT_CATEGORIES: Record<AmlDocumentType, AmlDocumentCategory> = {
  passport:                'primary',
  birth_certificate:       'primary',
  citizenship_certificate: 'primary',
  drivers_licence:         'secondary_a',
  government_id_card:      'secondary_a',
  proof_of_age_card:       'secondary_a',
  medicare_card:           'secondary_b',
  credit_card:             'secondary_b',
  bank_card:               'secondary_b',
  utility_bill:            'supporting',
  bank_statement:          'supporting',
  council_rates:           'supporting',
  lease_agreement:         'supporting',
  centrelink_letter:       'supporting',
};

// ─── AML Check ────────────────────────────────────────────────────────────────

export const AmlCheckStatusSchema = z.enum([
  'pending',
  'in_progress',
  'passed',
  'failed',
  'expired',
  'waived',
]);

export const AmlVerificationMethodSchema = z.enum([
  'face_to_face',
  'certified_copies',
  'electronic',
  'third_party',
]);

export const AmlCheckSchema = z.object({
  id: z.string().uuid(),
  contactId: z.string().uuid(),
  agentId: z.string().uuid(),
  status: AmlCheckStatusSchema,
  verificationMethod: AmlVerificationMethodSchema.nullable(),
  totalPoints: z.number().int().min(0).max(300),
  pointsRequired: z.number().int().min(1).default(100),
  fullLegalName: z.string().nullable(),
  dateOfBirth: z.string().date().nullable(),
  residentialAddress: z.string().nullable(),
  addressVerified: z.boolean(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  expiryDate: z.string().date().nullable(),
  lastReviewedAt: z.string().datetime().nullable(),
  verifiedByUserId: z.string().uuid().nullable(),
  rejectionReason: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateAmlCheckSchema = z.object({
  contactId: z.string().uuid(),
  verificationMethod: AmlVerificationMethodSchema,
  fullLegalName: z.string().min(2),
  dateOfBirth: z.string().date(),
  residentialAddress: z.string().min(5),
});

export const UpdateAmlCheckSchema = z.object({
  verificationMethod: AmlVerificationMethodSchema.optional(),
  fullLegalName: z.string().min(2).optional(),
  dateOfBirth: z.string().date().optional(),
  residentialAddress: z.string().min(5).optional(),
  addressVerified: z.boolean().optional(),
  notes: z.string().optional(),
});

export const CompleteAmlCheckSchema = z.object({
  outcome: z.enum(['passed', 'failed']),
  rejectionReason: z.string().optional(),
});

// ─── Identity Documents ───────────────────────────────────────────────────────

export const AmlIdentityDocumentSchema = z.object({
  id: z.string().uuid(),
  checkId: z.string().uuid(),
  documentId: z.string().uuid().nullable(),
  documentType: AmlDocumentTypeSchema,
  points: z.number().int().min(1),
  documentNumber: z.string().nullable(),
  issuingAuthority: z.string().nullable(),
  issueDate: z.string().date().nullable(),
  expiryDate: z.string().date().nullable(),
  isExpired: z.boolean(),
  verified: z.boolean(),
  verifiedBy: z.string().uuid().nullable(),
  verifiedAt: z.string().datetime().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const AddAmlDocumentSchema = z.object({
  documentType: AmlDocumentTypeSchema,
  documentNumber: z.string().optional(),
  issuingAuthority: z.string().optional(),
  issueDate: z.string().date().optional(),
  expiryDate: z.string().date().optional(),
  notes: z.string().optional(),
});

// ─── Suspicious Matter Reports ────────────────────────────────────────────────

export const AmlSmrStatusSchema = z.enum(['draft', 'submitted', 'acknowledged']);

export const AmlSuspiciousMatterReportSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  contactId: z.string().uuid().nullable(),
  transactionId: z.string().uuid().nullable(),
  description: z.string(),
  suspicionBasis: z.string(),
  amountAud: z.number().nullable(),
  reportDate: z.string().date(),
  austracRef: z.string().nullable(),
  status: AmlSmrStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateAmlSmrSchema = z.object({
  contactId: z.string().uuid().optional(),
  transactionId: z.string().uuid().optional(),
  description: z.string().min(10),
  suspicionBasis: z.string().min(10),
  amountAud: z.number().positive().optional(),
});

// ─── Compliance Report ────────────────────────────────────────────────────────

export const ComplianceReportSchema = z.object({
  agentId: z.string().uuid(),
  agentName: z.string(),
  periodFrom: z.string().date(),
  periodTo: z.string().date(),
  totalChecks: z.number().int().min(0),
  passedChecks: z.number().int().min(0),
  failedChecks: z.number().int().min(0),
  pendingChecks: z.number().int().min(0),
  expiringWithin90Days: z.number().int().min(0),
  smrCount: z.number().int().min(0),
  generatedAt: z.string().datetime(),
  checks: z.array(AmlCheckSchema),
});

// ─── Validation Result ────────────────────────────────────────────────────────

export const AmlValidationResultSchema = z.object({
  isValid: z.boolean(),
  totalPoints: z.number().int(),
  hasPrimaryOrSecondaryA: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type AmlCheckStatus              = z.infer<typeof AmlCheckStatusSchema>;
export type AmlVerificationMethod       = z.infer<typeof AmlVerificationMethodSchema>;
export type AmlCheck                    = z.infer<typeof AmlCheckSchema>;
export type CreateAmlCheck              = z.infer<typeof CreateAmlCheckSchema>;
export type UpdateAmlCheck              = z.infer<typeof UpdateAmlCheckSchema>;
export type CompleteAmlCheck            = z.infer<typeof CompleteAmlCheckSchema>;
export type AmlIdentityDocument         = z.infer<typeof AmlIdentityDocumentSchema>;
export type AddAmlDocument              = z.infer<typeof AddAmlDocumentSchema>;
export type AmlSmrStatus                = z.infer<typeof AmlSmrStatusSchema>;
export type AmlSuspiciousMatterReport   = z.infer<typeof AmlSuspiciousMatterReportSchema>;
export type CreateAmlSmr                = z.infer<typeof CreateAmlSmrSchema>;
export type ComplianceReport            = z.infer<typeof ComplianceReportSchema>;
export type AmlValidationResult         = z.infer<typeof AmlValidationResultSchema>;
