import type { DDTemplate } from './types';

export const QLD_DD_TEMPLATE: DDTemplate = {
  state: 'QLD',
  items: [
    // ─── Legal (6 items) ──────────────────────────────────────────────
    { category: 'legal', name: 'Contract of sale reviewed', description: 'Solicitor to review all contract terms, special conditions, and disclosure documents', assignedTo: 'solicitor', isBlocking: true, isCritical: true },
    { category: 'legal', name: 'Title search completed', description: 'Verify property title, registered owner, and any encumbrances', assignedTo: 'solicitor', isBlocking: true, isCritical: true },
    { category: 'legal', name: 'Easements and encumbrances checked', description: 'Review all easements, covenants, and registered interests on the title', assignedTo: 'solicitor', isBlocking: true, isCritical: true },
    { category: 'legal', name: 'Body corporate records obtained', description: 'Request and review body corporate records including minutes, financial statements, and by-laws', assignedTo: 'solicitor', isBlocking: true, isCritical: true, applicableTo: ['unit', 'townhouse', 'villa', 'apartment'] },
    { category: 'legal', name: 'Seller disclosure statement reviewed', description: 'QLD-specific: review Form 1 seller disclosure statement for material facts', assignedTo: 'solicitor', isBlocking: true, isCritical: true },
    { category: 'legal', name: 'Pool safety certificate verified', description: 'Verify current pool safety certificate exists (mandatory in QLD for properties with pools)', assignedTo: 'buyers_agent', isBlocking: false, isCritical: true },

    // ─── Physical (4 items) ───────────────────────────────────────────
    { category: 'physical', name: 'Building inspection completed', description: 'Engage licensed building inspector for comprehensive structural assessment', assignedTo: 'building_inspector', isBlocking: true, isCritical: true, excludeFrom: ['land'] },
    { category: 'physical', name: 'Pest/termite inspection completed', description: 'Engage licensed pest inspector for termite and pest assessment', assignedTo: 'pest_inspector', isBlocking: true, isCritical: true, excludeFrom: ['land'] },
    { category: 'physical', name: 'Strata inspection report', description: 'Independent strata inspection covering common areas, maintenance, and defects', assignedTo: 'solicitor', isBlocking: true, isCritical: true, applicableTo: ['unit', 'townhouse', 'villa', 'apartment'] },
    { category: 'physical', name: 'Pre-settlement inspection scheduled', description: 'Arrange final walkthrough inspection before settlement', assignedTo: 'buyers_agent', isBlocking: true, isCritical: true },

    // ─── Financial (6 items) ──────────────────────────────────────────
    { category: 'financial', name: 'Finance approval (unconditional)', description: 'Obtain unconditional finance approval from lender', assignedTo: 'broker', isBlocking: true, isCritical: true },
    { category: 'financial', name: 'Deposit paid', description: 'Ensure deposit is paid to trust account by due date', assignedTo: 'client', isBlocking: true, isCritical: true },
    { category: 'financial', name: 'Insurance arranged', description: 'Arrange building and contents insurance effective from settlement', assignedTo: 'client', isBlocking: true, isCritical: true },
    { category: 'financial', name: 'Stamp duty calculated and budgeted', description: 'Calculate QLD transfer duty and ensure funds are available', assignedTo: 'solicitor', isBlocking: false, isCritical: false },
    { category: 'financial', name: 'Council rates checked', description: 'Verify current council rates and any outstanding amounts for adjustment', assignedTo: 'solicitor', isBlocking: false, isCritical: false },
    { category: 'financial', name: 'Water rates checked', description: 'Verify current water rates and any outstanding amounts for adjustment', assignedTo: 'solicitor', isBlocking: false, isCritical: false },

    // ─── Environmental (4 items) ──────────────────────────────────────
    { category: 'environmental', name: 'Flood zone check', description: 'Check council flood maps and historical flood data for the property', assignedTo: 'buyers_agent', isBlocking: false, isCritical: true },
    { category: 'environmental', name: 'Bushfire zone check', description: 'Verify bushfire attack level (BAL) rating for the property area', assignedTo: 'buyers_agent', isBlocking: false, isCritical: true },
    { category: 'environmental', name: 'Asbestos assessment', description: 'Assess for asbestos presence in buildings constructed before 1990', assignedTo: 'building_inspector', isBlocking: false, isCritical: false },
    { category: 'environmental', name: 'Contamination check', description: 'Check environmental management register for former land use contamination', assignedTo: 'buyers_agent', isBlocking: false, isCritical: false },

    // ─── Council (4 items) ────────────────────────────────────────────
    { category: 'council', name: 'Zoning verification', description: 'Confirm property zoning aligns with intended use', assignedTo: 'solicitor', isBlocking: false, isCritical: false },
    { category: 'council', name: 'Approved vs unapproved structures', description: 'Check council records for building approvals matching actual structures', assignedTo: 'buyers_agent', isBlocking: false, isCritical: true },
    { category: 'council', name: 'Planned infrastructure nearby', description: 'Check for any planned council or state infrastructure that may impact the property', assignedTo: 'buyers_agent', isBlocking: false, isCritical: false },
    { category: 'council', name: 'Heritage overlay check', description: 'Check if property is subject to heritage listing or overlay', assignedTo: 'solicitor', isBlocking: false, isCritical: false },
  ],
};
