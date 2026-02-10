import { getDDTemplate, getSupportedStates } from './dd-templates';
import type { DDTemplateItem } from './dd-templates/types';

export interface GeneratedChecklistItem {
  category: string;
  name: string;
  description: string;
  assignedTo: string;
  isBlocking: boolean;
  isCritical: boolean;
  sortOrder: number;
}

export interface GeneratedChecklist {
  state: string;
  propertyType: string;
  items: GeneratedChecklistItem[];
}

export class DueDiligenceEngine {
  /**
   * Generate a due diligence checklist for a given state and property type.
   * Filters template items based on property type applicability.
   */
  static generateChecklist(state: string, propertyType: string): GeneratedChecklist | null {
    const template = getDDTemplate(state);
    if (!template) return null;

    const filteredItems = template.items.filter((item: DDTemplateItem) => {
      // Check applicableTo: if set, property type must be in the list
      if (item.applicableTo && !item.applicableTo.includes(propertyType)) {
        return false;
      }
      // Check excludeFrom: if set, property type must NOT be in the list
      if (item.excludeFrom && item.excludeFrom.includes(propertyType)) {
        return false;
      }
      return true;
    });

    return {
      state: state.toUpperCase(),
      propertyType,
      items: filteredItems.map((item: DDTemplateItem, index: number) => ({
        category: item.category,
        name: item.name,
        description: item.description,
        assignedTo: item.assignedTo,
        isBlocking: item.isBlocking,
        isCritical: item.isCritical,
        sortOrder: index,
      })),
    };
  }

  /**
   * Calculate completion percentage for a checklist.
   */
  static calculateCompletion(itemStatuses: string[]): number {
    if (itemStatuses.length === 0) return 0;
    const completed = itemStatuses.filter(
      (s: string) => s === 'completed' || s === 'not_applicable'
    ).length;
    return Math.round((completed / itemStatuses.length) * 100);
  }

  /**
   * Check if any blocking items have issues.
   */
  static hasBlockingIssues(items: Array<{ isBlocking: boolean; status: string }>): boolean {
    return items.some(item => item.isBlocking && item.status === 'issue_found');
  }

  /**
   * Get the list of supported Australian states.
   */
  static getSupportedStates(): string[] {
    return getSupportedStates();
  }

  /**
   * Get count of items by status for summary display.
   */
  static getStatusSummary(items: Array<{ status: string }>): Record<string, number> {
    const summary: Record<string, number> = {};
    for (const item of items) {
      summary[item.status] = (summary[item.status] ?? 0) + 1;
    }
    return summary;
  }
}
