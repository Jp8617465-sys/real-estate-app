import type { DueDiligenceCategory, DueDiligenceAssignee } from '@realflow/shared';

export interface DDTemplateItem {
  category: DueDiligenceCategory;
  name: string;
  description: string;
  assignedTo: DueDiligenceAssignee;
  isBlocking: boolean;
  isCritical: boolean;
  // Some items only apply to certain property types
  applicableTo?: string[];  // e.g., ['unit', 'townhouse'] for strata items
  excludeFrom?: string[];   // e.g., ['land'] for building inspection
}

export interface DDTemplate {
  state: string;
  items: DDTemplateItem[];
}
