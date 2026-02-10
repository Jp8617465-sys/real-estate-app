import type { DDTemplate } from './types';

export const VIC_DD_TEMPLATE: DDTemplate = {
  state: 'VIC',
  items: [
    // ─── Legal (6 items) ──────────────────────────────────────────────
    { category: 'legal', name: 'Section 32 vendor statement reviewed', description: 'VIC-specific: review vendor statement (Section 32) including title, planning, and building information', assignedTo: 'solicitor', isBlocking: true, isCritical: true },
    { category: 'legal', name: 'Contract of sale reviewed', description: 'Solicitor to review all contract terms, special conditions, and particulars of sale', assignedTo: 'solicitor', isBlocking: true, isCritical: true },
    { category: 'legal', name: 'Title search completed', description: 'Verify property title, registered owner, and any encumbrances via LANDATA', assignedTo: 'solicitor', isBlocking: true, isCritical: true },
    { category: 'legal', name: 'Easements and encumbrances checked', description: 'Review all easements, covenants, and registered interests on the title', assignedTo: 'solicitor', isBlocking: true, isCritical: true },
    { category: 'legal', name: 'Owners corporation certificate obtained', description: 'VIC-specific: obtain owners corporation certificate covering rules, fees, insurance, and maintenance plans', assignedTo: 'solicitor', isBlocking: true, isCritical: true, applicableTo: ['unit', 'townhouse', 'villa', 'apartment'] },
    { category: 'legal', name: 'Swimming pool and spa compliance', description: 'Verify pool/spa barrier compliance with Victorian building regulations', assignedTo: 'buyers_agent', isBlocking: false, isCritical: true },

    // ─── Physical (4 items) ───────────────────────────────────────────
    { category: 'physical', name: 'Building inspection completed', description: 'Engage licensed building inspector for comprehensive structural assessment', assignedTo: 'building_inspector', isBlocking: true, isCritical: true, excludeFrom: ['land'] },
    { category: 'physical', name: 'Pest/termite inspection completed', description: 'Engage licensed pest inspector for termite and pest assessment', assignedTo: 'pest_inspector', isBlocking: true, isCritical: true, excludeFrom: ['land'] },
    { category: 'physical', name: 'Strata inspection report', description: 'Independent strata inspection covering common areas, maintenance, and defects', assignedTo: 'solicitor', isBlocking: true, isCritical: true, applicableTo: ['unit', 'townhouse', 'villa', 'apartment'] },
    { category: 'physical', name: 'Pre-settlement inspection scheduled', description: 'Arrange final walkthrough inspection before settlement', assignedTo: 'buyers_agent', isBlocking: true, isCritical: true },

    // ─── Financial (5 items) ──────────────────────────────────────────
    { category: 'financial', name: 'Finance approval (unconditional)', description: 'Obtain unconditional finance approval from lender', assignedTo: 'broker', isBlocking: true, isCritical: true },
    { category: 'financial', name: 'Deposit paid', description: 'Ensure deposit is paid to trust account by due date (typically 10% in VIC)', assignedTo: 'client', isBlocking: true, isCritical: true },
    { category: 'financial', name: 'Insurance arranged', description: 'Arrange building and contents insurance effective from settlement', assignedTo: 'client', isBlocking: true, isCritical: true },
    { category: 'financial', name: 'Stamp duty calculated and budgeted', description: 'Calculate VIC land transfer duty including any first home buyer exemptions and ensure funds are available', assignedTo: 'solicitor', isBlocking: false, isCritical: false },
    { category: 'financial', name: 'Council and water rates checked', description: 'Verify current council and water rates and any outstanding amounts for adjustment at settlement', assignedTo: 'solicitor', isBlocking: false, isCritical: false },

    // ─── Environmental (3 items) ──────────────────────────────────────
    { category: 'environmental', name: 'Flood zone check', description: 'Check council flood maps and Melbourne Water data for flood risk assessment', assignedTo: 'buyers_agent', isBlocking: false, isCritical: true },
    { category: 'environmental', name: 'Bushfire zone check', description: 'Verify bushfire management overlay (BMO) and bushfire prone area status', assignedTo: 'buyers_agent', isBlocking: false, isCritical: true },
    { category: 'environmental', name: 'Contamination check', description: 'Check EPA Victoria priority sites register for contamination risk', assignedTo: 'buyers_agent', isBlocking: false, isCritical: false },

    // ─── Council (4 items) ────────────────────────────────────────────
    { category: 'council', name: 'Zoning verification', description: 'Confirm property zoning under the Victorian planning scheme aligns with intended use', assignedTo: 'solicitor', isBlocking: false, isCritical: false },
    { category: 'council', name: 'Planning overlay check', description: 'VIC-specific: review all planning overlays (heritage, design, environmental significance) affecting the property', assignedTo: 'solicitor', isBlocking: false, isCritical: true },
    { category: 'council', name: 'Building permit check', description: 'VIC-specific: verify all building permits and occupancy certificates match constructed structures', assignedTo: 'buyers_agent', isBlocking: false, isCritical: true },
    { category: 'council', name: 'Planned infrastructure nearby', description: 'Check for any planned council or state infrastructure projects that may impact the property', assignedTo: 'buyers_agent', isBlocking: false, isCritical: false },
  ],
};
