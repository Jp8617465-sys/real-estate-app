import { z } from 'zod';

// ─── Message Channels ──────────────────────────────────────────────
export const MessageChannelSchema = z.enum([
  'email',
  'sms',
  'phone_call',
  'whatsapp',
  'instagram_dm',
  'facebook_messenger',
  'domain_enquiry',
  'rea_enquiry',
  'linkedin',
  'internal_note',
  'portal_notification',
]);
export type MessageChannel = z.infer<typeof MessageChannelSchema>;

// ─── Message Direction ─────────────────────────────────────────────
export const MessageDirectionSchema = z.enum(['inbound', 'outbound']);
export type MessageDirection = z.infer<typeof MessageDirectionSchema>;

// ─── Message Status ────────────────────────────────────────────────
export const MessageStatusSchema = z.enum([
  'pending',
  'delivered',
  'read',
  'failed',
]);
export type MessageStatus = z.infer<typeof MessageStatusSchema>;

// ─── Call Outcome ──────────────────────────────────────────────────
export const CallOutcomeSchema = z.enum([
  'answered',
  'missed',
  'voicemail',
  'no_answer',
]);
export type CallOutcome = z.infer<typeof CallOutcomeSchema>;

// ─── Portal Source ─────────────────────────────────────────────────
export const PortalSourceSchema = z.enum(['domain', 'realestate.com.au']);
export type PortalSource = z.infer<typeof PortalSourceSchema>;

// ─── Attachment ────────────────────────────────────────────────────
export const AttachmentSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().nonnegative(),
  url: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

// ─── Message Content ───────────────────────────────────────────────
export const MessageContentSchema = z.object({
  text: z.string().optional(),
  html: z.string().optional(),
  subject: z.string().optional(),
  attachments: z.array(AttachmentSchema).optional(),
});
export type MessageContent = z.infer<typeof MessageContentSchema>;

// ─── Message Metadata (channel-specific) ───────────────────────────
export const MessageMetadataSchema = z.object({
  // Email
  emailMessageId: z.string().optional(),
  emailThreadId: z.string().optional(),
  from: z.string().optional(),
  to: z.array(z.string()).optional(),
  cc: z.array(z.string()).optional(),

  // SMS / Phone
  twilioSid: z.string().optional(),
  phoneFrom: z.string().optional(),
  phoneTo: z.string().optional(),

  // Phone call
  callDuration: z.number().nonnegative().optional(),
  callRecordingUrl: z.string().url().optional(),
  callTranscription: z.string().optional(),
  callOutcome: CallOutcomeSchema.optional(),

  // Social
  instagramIgsid: z.string().optional(),
  facebookPsid: z.string().optional(),
  socialPostId: z.string().optional(),

  // Portal
  portalListingId: z.string().optional(),
  portalPropertyAddress: z.string().optional(),
  portalSource: PortalSourceSchema.optional(),

  // WhatsApp
  whatsappMessageId: z.string().optional(),
});
export type MessageMetadata = z.infer<typeof MessageMetadataSchema>;

// ─── Conversation Message ──────────────────────────────────────────
export const ConversationMessageSchema = z.object({
  id: z.string().uuid(),

  // Channel identification
  channel: MessageChannelSchema,
  direction: MessageDirectionSchema,

  // Contact linking
  contactId: z.string().uuid(),
  agentId: z.string().uuid(),

  // Content
  content: MessageContentSchema,

  // Channel-specific metadata
  metadata: MessageMetadataSchema,

  // Context
  propertyId: z.string().uuid().optional(),
  transactionId: z.string().uuid().optional(),
  threadId: z.string().uuid().optional(),

  // Status
  status: MessageStatusSchema,
  isRead: z.boolean().default(false),

  // Soft delete
  isDeleted: z.boolean().default(false),
  deletedAt: z.string().datetime().optional(),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

// ─── Create Conversation Message ───────────────────────────────────
export const CreateConversationMessageSchema = ConversationMessageSchema.omit({
  id: true,
  isDeleted: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  threadId: true,
  propertyId: true,
  transactionId: true,
  isRead: true,
});
export type CreateConversationMessage = z.infer<typeof CreateConversationMessageSchema>;

// ─── Contact Channels ──────────────────────────────────────────────
export const ContactChannelsSchema = z.object({
  id: z.string().uuid(),
  contactId: z.string().uuid(),

  emails: z.array(z.string().email()).default([]),
  phones: z.array(z.string()).default([]),
  instagramId: z.string().optional(),
  facebookId: z.string().optional(),
  whatsappNumber: z.string().optional(),
  linkedinProfileUrl: z.string().url().optional(),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ContactChannels = z.infer<typeof ContactChannelsSchema>;

// ─── Upsert Contact Channels ──────────────────────────────────────
export const UpsertContactChannelsSchema = ContactChannelsSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type UpsertContactChannels = z.infer<typeof UpsertContactChannelsSchema>;

// ─── Inbox Filters ─────────────────────────────────────────────────
export const InboxFilterSchema = z.object({
  channels: z.array(MessageChannelSchema).optional(),
  contactId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  isRead: z.boolean().optional(),
  hasReply: z.boolean().optional(),
  propertyId: z.string().uuid().optional(),
  searchQuery: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});
export type InboxFilter = z.infer<typeof InboxFilterSchema>;

// ─── Inbox Thread Summary ──────────────────────────────────────────
export const InboxThreadSummarySchema = z.object({
  contactId: z.string().uuid(),
  contactFirstName: z.string(),
  contactLastName: z.string(),
  lastMessage: ConversationMessageSchema,
  unreadCount: z.number().int().nonnegative(),
  channels: z.array(MessageChannelSchema),
});
export type InboxThreadSummary = z.infer<typeof InboxThreadSummarySchema>;

// ─── Conversation Thread ───────────────────────────────────────────
export const ConversationThreadSchema = z.object({
  contactId: z.string().uuid(),
  messages: z.array(ConversationMessageSchema),
  totalMessages: z.number().int().nonnegative(),
});
export type ConversationThread = z.infer<typeof ConversationThreadSchema>;

// ─── Send Message Request ──────────────────────────────────────────
export const SendMessageRequestSchema = z.object({
  contactId: z.string().uuid(),
  channel: MessageChannelSchema,
  content: MessageContentSchema,
  propertyId: z.string().uuid().optional(),
  transactionId: z.string().uuid().optional(),
});
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

// ─── Inbound Webhook Payload (normalised) ──────────────────────────
export const NormalisedInboundMessageSchema = z.object({
  channel: MessageChannelSchema,
  direction: z.literal('inbound'),

  // Sender identification (at least one must be present)
  senderEmail: z.string().email().optional(),
  senderPhone: z.string().optional(),
  senderSocialId: z.string().optional(),
  senderName: z.string().optional(),

  // Content
  content: MessageContentSchema,
  metadata: MessageMetadataSchema,

  // Optional context
  propertyRef: z.string().optional(),
  externalMessageId: z.string().optional(),
  receivedAt: z.string().datetime(),
});
export type NormalisedInboundMessage = z.infer<typeof NormalisedInboundMessageSchema>;
