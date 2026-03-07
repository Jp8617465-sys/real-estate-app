import { z } from 'zod';

export const PortalBriefAcknowledgementSchema = z.object({
  clientBriefId: z.string().uuid(),
  acknowledgedAt: z.string().datetime(),
  ipAddress: z.string().optional(),
})
export type PortalBriefAcknowledgement = z.infer<typeof PortalBriefAcknowledgementSchema>

export const PortalPropertyFeedbackSchema = z.object({
  propertyMatchId: z.string().uuid(),
  feedback: z.enum(['interested', 'not_interested', 'ask_agent']),
  notes: z.string().max(500).optional(),
})
export type PortalPropertyFeedback = z.infer<typeof PortalPropertyFeedbackSchema>

export const PortalInspectionFeedbackSchema = z.object({
  inspectionId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  feedback: z.string().max(1000).optional(),
})
export type PortalInspectionFeedback = z.infer<typeof PortalInspectionFeedbackSchema>
