// Day-1 contract: consistent empty-state interface across web and portal

export type EmptyStateIllustration =
  | 'contacts'
  | 'properties'
  | 'pipeline'
  | 'alerts'
  | 'matches'
  | 'documents'
  | 'messages'
  | 'generic';

export interface EmptyStateProps {
  illustration: EmptyStateIllustration;
  heading: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  illustrationWidth?: number;
}
