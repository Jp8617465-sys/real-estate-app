import type { DDTemplate } from './types';

export const NSW_DD_TEMPLATE: DDTemplate = {
  state: 'NSW',
  items: [
    // ─── Legal (6 items) ──────────────────────────────────────────────
    { category: 'legal', name: 'Contract of sale reviewed', description: 'Solicitor to review all contract terms, special conditions, and vendor disclosure', assignedTo: 'solicitor', isBlocking: true, isCritical: true },
    { category: 'legal', name: 'Title search completed', description: 'Verify property title, registered owner, and any encumbrances via NSW LRS', assignedTo: 'solicitor', isBlocking: true, isCritical: true },
    { category: 'legal', name: 'Easements and encumbrances checked', description: 'Review all easements, covenants, and registered interests on the title', assignedTo: 'solicitor', isBlocking: true, isCritical: true },
    { category: 'legal', name: 's66W certificate exchange', description: 'NSW-specific: obtain s66W certificate to waive cooling-off period for unconditional exchange', assignedTo: 'solicitor', isBlocking: true, isCritical: true },
    { category: 'legal', name: 'Strata search and s184 certificate', description: 'Obtain s184 certificate from strata manager covering financials, by-laws, and levies', assignedTo: 'solicitor', isBlocking: true, isCritical: true, applicableTo: ['unit', 'townhouse', 'villa', 'apartment'] },
    { category: 'legal', name: 'Swimming pool compliance certificate', description: 'Verify swimming pool compliance certificate is current under NSW pool safety laws', assignedTo: 'buyers_agent', isBlocking: false, isCritical: true },

    // ─── Physical (4 items) ───────────────────────────────────────────
    { category: 'physical', name: 'Building inspection completed', description: 'Engage licensed building inspector for comprehensive structural assessment', assignedTo: 'building_inspector', isBlocking: true, isCritical: true, excludeFrom: ['land'] },
    { category: 'physical', name: 'Pest/termite inspection completed', description: 'Engage licensed pest inspector for termite and pest assessment', assignedTo: 'pest_inspector', isBlocking: true, isCritical: true, excludeFrom: ['land'] },
    { category: 'physical', name: 'Strata inspection report', description: 'Independent strata inspection covering common areas, maintenance, and defects', assignedTo: 'solicitor', isBlocking: true, isCritical: true, applicableTo: ['unit', 'townhouse', 'villa', 'apartment'] },
    { category: 'physical', name: 'Pre-settlement inspection scheduled', description: 'Arrange final walkthrough inspection before settlement', assignedTo: 'buyers_agent', isBlocking: true, isCritical: true },

    // ─── Financial (6 items) ──────────────────────────────────────────
    { category: 'financial', name: 'Finance approval (unconditional)', description: 'Obtain unconditional finance approval from lender', assignedTo: 'broker', isBlocking: true, isCritical: true },
    { category: 'financial', name: 'Deposit paid', description: 'Ensure deposit is paid to trust account by due date (typically 10% in NSW)', assignedTo: 'client', isBlocking: true, isCritical: true },
    { category: 'financial', name: 'Insurance arranged', description: 'Arrange building and contents insurance effective from exchange (risk passes at exchange in NSW)', assignedTo: 'client', isBlocking: true, isCritical: true },
    { category: 'financial', name: 'Stamp duty calculated and budgeted', description: 'Calculate NSW transfer duty including any first home buyer concessions and ensure funds are available', assignedTo: 'solicitor', isBlocking: false, isCritical: false },
    { category: 'financial', name: 'Home Building Compensation Fund check', description: 'NSW-specific: verify HBCF insurance for residential properties less than 7 years old', assignedTo: 'solicitor', isBlocking: false, isCritical: true },
    { category: 'financial', name: 'Water and council rates checked', description: 'Verify current water and council rates and any outstanding amounts for adjustment at settlement', assignedTo: 'solicitor', isBlocking: false, isCritical: false },

    // ─── Environmental (3 items) ──────────────────────────────────────
    { category: 'environmental', name: 'Flood zone check', description: 'Check council flood maps and historical flood data for the property', assignedTo: 'buyers_agent', isBlocking: false, isCritical: true },
    { category: 'environmental', name: 'Bushfire zone check', description: 'Verify bushfire attack level (BAL) rating and bush fire prone land map status', assignedTo: 'buyers_agent', isBlocking: false, isCritical: true },
    { category: 'environmental', name: 'Contamination check', description: 'Check NSW EPA contaminated land record and former land use for contamination risk', assignedTo: 'buyers_agent', isBlocking: false, isCritical: false },

    // ─── Council (3 items) ────────────────────────────────────────────
    { category: 'council', name: 'Zoning verification', description: 'Confirm property zoning under local environmental plan (LEP) aligns with intended use', assignedTo: 'solicitor', isBlocking: false, isCritical: false },
    { category: 'council', name: 'Approved vs unapproved structures', description: 'Check council records and s10.7 certificate for building approvals matching actual structures', assignedTo: 'buyers_agent', isBlocking: false, isCritical: true },
    { category: 'council', name: 'Planned infrastructure nearby', description: 'Check for any planned council or state infrastructure projects that may impact the property', assignedTo: 'buyers_agent', isBlocking: false, isCritical: false },
  ],
};
