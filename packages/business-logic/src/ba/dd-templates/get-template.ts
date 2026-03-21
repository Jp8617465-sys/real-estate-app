import { QLD_DD_TEMPLATE } from './qld';
import { NSW_DD_TEMPLATE } from './nsw';
import { VIC_DD_TEMPLATE } from './vic';
import type { DDTemplate } from './types';

const TEMPLATES: Record<string, DDTemplate> = {
  QLD: QLD_DD_TEMPLATE,
  NSW: NSW_DD_TEMPLATE,
  VIC: VIC_DD_TEMPLATE,
};

export function getDDTemplate(state: string): DDTemplate | undefined {
  return TEMPLATES[state.toUpperCase()];
}

export function getSupportedStates(): string[] {
  return Object.keys(TEMPLATES);
}
