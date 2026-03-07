/**
 * Reusable test fixtures for RealFlow API tests.
 *
 * All fixtures use realistic Australian property data:
 * - AUD currency values
 * - Australian addresses with state/postcode
 * - Australian mobile phone format (04xx xxx xxx)
 * - Australian portal references (Domain, REA)
 */

// ─── Contact Fixtures ───────────────────────────────────────────────

export const CONTACTS = {
  buyer: {
    id: '11111111-1111-1111-1111-111111111111',
    first_name: 'Sarah',
    last_name: 'Johnson',
    email: 'sarah.j@email.com',
    phone: '0413 222 333',
    secondary_phone: null,
    types: ['buyer'],
    source: 'domain',
    status: 'active',
    tags: ['buyer', 'pre-approved'],
    assigned_agent_id: '00000000-0000-0000-0000-000000000001',
    communication_preference: 'email',
    lead_score: 78,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-15T00:00:00.000Z',
    deleted_at: null,
  },
  seller: {
    id: '22222222-2222-2222-2222-222222222222',
    first_name: 'Michael',
    last_name: 'Brown',
    email: 'mike.b@gmail.com',
    phone: '0422 111 444',
    secondary_phone: null,
    types: ['seller'],
    source: 'referral',
    status: 'active',
    tags: ['seller', 'eastern-suburbs'],
    assigned_agent_id: '00000000-0000-0000-0000-000000000001',
    communication_preference: 'phone',
    lead_score: 65,
    created_at: '2026-01-05T00:00:00.000Z',
    updated_at: '2026-01-20T00:00:00.000Z',
    deleted_at: null,
  },
  investor: {
    id: '33333333-3333-3333-3333-333333333333',
    first_name: 'Alex',
    last_name: 'Chen',
    email: 'alex.c@invest.com.au',
    phone: '0455 987 654',
    secondary_phone: '02 9876 5432',
    types: ['buyer'],
    source: 'linkedin',
    status: 'active',
    tags: ['investor', 'smsf'],
    assigned_agent_id: '00000000-0000-0000-0000-000000000001',
    communication_preference: 'email',
    lead_score: 90,
    created_at: '2026-01-10T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
    deleted_at: null,
  },
} as const;

// ─── Property Fixtures ──────────────────────────────────────────────

export const PROPERTIES = {
  bondiHouse: {
    id: 'aaaa1111-1111-1111-1111-111111111111',
    address: {
      street_number: '42',
      street_name: 'Ocean Street',
      unit_number: null,
      suburb: 'Bondi',
      state: 'NSW',
      postcode: '2026',
      country: 'AU',
    },
    property_type: 'house',
    bedrooms: 4,
    bathrooms: 2,
    car_spaces: 2,
    land_size: 450,
    listing_status: 'active',
    list_price: 2100000,
    price_guide: '$2,000,000 - $2,200,000',
    listing_description: 'Stunning beachside home with ocean views, renovated kitchen, and heated pool.',
    sale_type: 'auction',
    auction_date: '2026-03-15T10:00:00.000Z',
    domain_listing_id: 'DOM-2045678',
    rea_listing_id: 'REA-8765432',
    assigned_agent_id: '00000000-0000-0000-0000-000000000001',
    portal_views: 250,
    enquiry_count: 18,
    inspection_count: 6,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
  },
  surryHillsUnit: {
    id: 'aaaa2222-2222-2222-2222-222222222222',
    address: {
      street_number: '28',
      street_name: 'Campbell Street',
      unit_number: '15',
      suburb: 'Surry Hills',
      state: 'NSW',
      postcode: '2010',
      country: 'AU',
    },
    property_type: 'unit',
    bedrooms: 2,
    bathrooms: 1,
    car_spaces: 1,
    land_size: null,
    building_size: 85,
    listing_status: 'active',
    list_price: 950000,
    price_guide: '$900,000 - $1,000,000',
    listing_description: 'Modern inner-city apartment with city views.',
    sale_type: 'private-treaty',
    assigned_agent_id: '00000000-0000-0000-0000-000000000001',
    portal_views: 180,
    enquiry_count: 12,
    inspection_count: 4,
    created_at: '2026-01-10T00:00:00.000Z',
    updated_at: '2026-02-05T00:00:00.000Z',
  },
  mosmanFamily: {
    id: 'aaaa3333-3333-3333-3333-333333333333',
    address: {
      street_number: '7',
      street_name: 'Harbour View Drive',
      unit_number: null,
      suburb: 'Mosman',
      state: 'NSW',
      postcode: '2088',
      country: 'AU',
    },
    property_type: 'house',
    bedrooms: 5,
    bathrooms: 3,
    car_spaces: 3,
    land_size: 680,
    listing_status: 'active',
    list_price: 4500000,
    price_guide: 'Contact Agent',
    listing_description: 'Prestigious family home with harbour views and private pool.',
    sale_type: 'expression-of-interest',
    assigned_agent_id: '00000000-0000-0000-0000-000000000001',
    portal_views: 320,
    enquiry_count: 8,
    inspection_count: 3,
    created_at: '2026-01-15T00:00:00.000Z',
    updated_at: '2026-02-10T00:00:00.000Z',
  },
} as const;

// ─── Pipeline Fixtures ──────────────────────────────────────────────

export const PIPELINE_STAGES = {
  buyer: [
    'new-lead',
    'brief-signed',
    'active-search',
    'inspection-review',
    'offer-negotiate',
    'under-contract',
    'settled',
    'settled-nurture',
  ],
  seller: [
    'appraisal-booked',
    'listed',
    'under-offer',
    'exchanged',
    'settled',
    'post-settlement',
  ],
} as const;

// ─── Client Brief Fixtures ──────────────────────────────────────────

export const CLIENT_BRIEFS = {
  standard: {
    id: 'bbbb1111-1111-1111-1111-111111111111',
    contact_id: CONTACTS.buyer.id,
    purchase_type: 'owner_occupier',
    enquiry_type: 'home_buyer',
    budget: {
      min: 1800000,
      max: 2200000,
      absolute_max: 2400000,
      stamp_duty_budgeted: true,
    },
    finance: {
      pre_approved: true,
      pre_approval_amount: 2200000,
      pre_approval_expiry: '2026-06-01T00:00:00.000Z',
      lender: 'Commonwealth Bank',
      first_home_buyer: false,
    },
    requirements: {
      property_types: ['house'],
      bedrooms: { min: 3, ideal: 4 },
      bathrooms: { min: 2 },
      car_spaces: { min: 1, ideal: 2 },
      suburbs: [
        { suburb: 'Bondi', state: 'NSW', postcode: '2026' },
        { suburb: 'Coogee', state: 'NSW', postcode: '2034' },
        { suburb: 'Bronte', state: 'NSW', postcode: '2024' },
      ],
      must_haves: ['pool', 'garden', 'parking'],
      nice_to_haves: ['ocean views', 'renovated kitchen', 'north-facing'],
      deal_breakers: ['main road', 'flood zone', 'strata issues'],
    },
    timeline: {
      urgency: '1_3_months',
    },
    communication: {
      preferred_method: 'email',
      update_frequency: 'weekly',
    },
    client_signed_off: true,
    signed_off_at: '2026-01-05T00:00:00.000Z',
    is_deleted: false,
    created_by: '00000000-0000-0000-0000-000000000001',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-05T00:00:00.000Z',
  },
} as const;

// ─── Property Match Fixtures ────────────────────────────────────────

export const PROPERTY_MATCHES = {
  highScore: {
    id: 'cccc1111-1111-1111-1111-111111111111',
    property_id: PROPERTIES.bondiHouse.id,
    client_brief_id: CLIENT_BRIEFS.standard.id,
    client_id: CONTACTS.buyer.id,
    overall_score: 88,
    score_breakdown: {
      price_match: 85,
      location_match: 95,
      size_match: 90,
      feature_match: 82,
    },
    status: 'new',
    matched_at: '2026-01-12T00:00:00.000Z',
    updated_at: '2026-01-12T00:00:00.000Z',
  },
  mediumScore: {
    id: 'cccc2222-2222-2222-2222-222222222222',
    property_id: PROPERTIES.surryHillsUnit.id,
    client_brief_id: CLIENT_BRIEFS.standard.id,
    client_id: CONTACTS.buyer.id,
    overall_score: 62,
    score_breakdown: {
      price_match: 90,
      location_match: 50,
      size_match: 55,
      feature_match: 45,
    },
    status: 'sent_to_client',
    matched_at: '2026-01-14T00:00:00.000Z',
    updated_at: '2026-01-14T00:00:00.000Z',
  },
} as const;

// ─── Offer Fixtures ─────────────────────────────────────────────────

export const OFFERS = {
  submitted: {
    id: 'dddd1111-1111-1111-1111-111111111111',
    transaction_id: 'eeee1111-1111-1111-1111-111111111111',
    property_id: PROPERTIES.bondiHouse.id,
    client_id: CONTACTS.buyer.id,
    sale_method: 'private_treaty',
    status: 'submitted',
    client_max_price: 2200000,
    recommended_offer: 2050000,
    walk_away_price: 2250000,
    conditions: ['finance', 'building and pest inspection'],
    settlement_period: 42,
    deposit_amount: 105000,
    deposit_type: 'cash',
    created_at: '2026-02-01T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
  },
  accepted: {
    id: 'dddd2222-2222-2222-2222-222222222222',
    transaction_id: 'eeee2222-2222-2222-2222-222222222222',
    property_id: PROPERTIES.surryHillsUnit.id,
    client_id: CONTACTS.investor.id,
    sale_method: 'private_treaty',
    status: 'accepted',
    client_max_price: 980000,
    recommended_offer: 930000,
    conditions: ['finance'],
    settlement_period: 56,
    deposit_amount: 93000,
    deposit_type: 'deposit_bond',
    created_at: '2026-01-20T00:00:00.000Z',
    updated_at: '2026-02-05T00:00:00.000Z',
  },
} as const;

// ─── Market Snapshot Fixtures ───────────────────────────────────────

export const MARKET_SNAPSHOTS = {
  bondi: {
    suburb: 'Bondi',
    state: 'NSW',
    median_price: 2350000,
    median_price_change_12m: 5.2,
    days_on_market: 28,
    auction_clearance_rate: 72,
    total_listings: 42,
    data_as_of: '2026-02-01T00:00:00.000Z',
  },
  coogee: {
    suburb: 'Coogee',
    state: 'NSW',
    median_price: 1950000,
    median_price_change_12m: 3.8,
    days_on_market: 32,
    auction_clearance_rate: 68,
    total_listings: 35,
    data_as_of: '2026-02-01T00:00:00.000Z',
  },
  surryHills: {
    suburb: 'Surry Hills',
    state: 'NSW',
    median_price: 1100000,
    median_price_change_12m: 2.1,
    days_on_market: 22,
    auction_clearance_rate: 75,
    total_listings: 58,
    data_as_of: '2026-02-01T00:00:00.000Z',
  },
} as const;

// ─── Agent/User Fixtures ────────────────────────────────────────────

export const USERS = {
  primaryAgent: {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'agent@realflow.com.au',
    full_name: 'David Martinez',
    role: 'agent',
    agency_name: 'RealFlow Property Group',
    phone: '0412 000 001',
  },
  secondaryAgent: {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'support@realflow.com.au',
    full_name: 'Emma Wilson',
    role: 'agent',
    agency_name: 'RealFlow Property Group',
    phone: '0412 000 002',
  },
} as const;

// ─── Consolidation Report Fixtures ──────────────────────────────────

export const CONSOLIDATION_REPORTS = {
  briefSummary: {
    id: 'ffff1111-1111-1111-1111-111111111111',
    client_id: CONTACTS.buyer.id,
    client_brief_id: CLIENT_BRIEFS.standard.id,
    type: 'client_brief_summary',
    title: 'client brief summary - 04/03/2026',
    status: 'ready',
    content: {
      executive_summary: 'Search for Bondi, Coogee: 2 properties reviewed, 1 strong match identified.',
      property_rankings: [],
      risks: [],
      recommended_actions: [],
      search_progress: {
        properties_reviewed: 2,
        inspections_completed: 1,
        offers_made: 1,
        days_in_search: 45,
      },
    },
    generated_by: 'automated',
    generated_at: '2026-03-04T00:00:00.000Z',
    created_by: USERS.primaryAgent.id,
    created_at: '2026-03-04T00:00:00.000Z',
    updated_at: '2026-03-04T00:00:00.000Z',
    deleted_at: null,
  },
} as const;
