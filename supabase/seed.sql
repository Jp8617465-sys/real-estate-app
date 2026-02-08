-- RealFlow Seed Data
-- Creates a sample office, users, contacts, and properties for development

-- ─── Office ─────────────────────────────────────────────────────────
INSERT INTO offices (id, name, address, phone, email) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'RealFlow Demo Agency', '123 George St, Sydney NSW 2000', '02 9000 0000', 'office@realflowdemo.com.au');

-- ─── Users ──────────────────────────────────────────────────────────
INSERT INTO users (id, email, first_name, last_name, phone, role, office_id) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'sarah@realflowdemo.com.au', 'Sarah', 'Mitchell', '0412 000 001', 'principal', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'james@realflowdemo.com.au', 'James', 'Chen', '0412 000 002', 'agent', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000003', 'emily@realflowdemo.com.au', 'Emily', 'Taylor', '0412 000 003', 'agent', 'a0000000-0000-0000-0000-000000000001');

-- ─── Teams ──────────────────────────────────────────────────────────
INSERT INTO teams (id, name, office_id, lead_agent_id) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Sales Team A', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001');

-- ─── Contacts ───────────────────────────────────────────────────────
INSERT INTO contacts (id, types, first_name, last_name, email, phone, source, assigned_agent_id, buyer_profile, tags) VALUES
  ('d0000000-0000-0000-0000-000000000001', '{buyer}', 'Michael', 'Johnson', 'michael.j@email.com', '0413 111 001', 'domain', 'b0000000-0000-0000-0000-000000000002',
   '{"budgetMin": 800000, "budgetMax": 1200000, "preApproved": true, "preApprovalAmount": 1100000, "propertyTypes": ["house", "townhouse"], "bedrooms": {"min": 3}, "bathrooms": {"min": 2}, "carSpaces": {"min": 1}, "suburbs": ["Bondi", "Coogee", "Randwick"], "mustHaves": ["north-facing", "outdoor space"], "dealBreakers": ["main road"]}',
   '{hot-lead, pre-approved}'),
  ('d0000000-0000-0000-0000-000000000002', '{buyer,investor}', 'Priya', 'Patel', 'priya.p@email.com', '0413 111 002', 'referral', 'b0000000-0000-0000-0000-000000000002',
   '{"budgetMin": 500000, "budgetMax": 750000, "preApproved": false, "propertyTypes": ["unit", "apartment"], "bedrooms": {"min": 2}, "bathrooms": {"min": 1}, "carSpaces": {"min": 1}, "suburbs": ["Surry Hills", "Darlinghurst", "Redfern"], "mustHaves": [], "dealBreakers": []}',
   '{investor, first-time-buyer}'),
  ('d0000000-0000-0000-0000-000000000003', '{seller}', 'David', 'Williams', 'david.w@email.com', '0413 111 003', 'website', 'b0000000-0000-0000-0000-000000000003',
   NULL, '{downsizer}'),
  ('d0000000-0000-0000-0000-000000000004', '{buyer}', 'Lisa', 'Nguyen', 'lisa.n@email.com', '0413 111 004', 'open-home', 'b0000000-0000-0000-0000-000000000003',
   '{"budgetMin": 1500000, "budgetMax": 2000000, "preApproved": true, "preApprovalAmount": 1800000, "propertyTypes": ["house"], "bedrooms": {"min": 4}, "bathrooms": {"min": 2}, "carSpaces": {"min": 2}, "suburbs": ["Mosman", "Cremorne", "Neutral Bay"], "mustHaves": ["pool", "garden"], "dealBreakers": ["strata"]}',
   '{pre-approved, upgrader}'),
  ('d0000000-0000-0000-0000-000000000005', '{referral-source}', 'Robert', 'Clarke', 'robert.c@lawfirm.com.au', '0413 111 005', 'referral', 'b0000000-0000-0000-0000-000000000001',
   NULL, '{solicitor, referral-partner}');

-- ─── Properties ─────────────────────────────────────────────────────
INSERT INTO properties (id, address_street_number, address_street_name, address_unit_number, address_suburb, address_state, address_postcode, property_type, bedrooms, bathrooms, car_spaces, land_size, listing_status, list_price, price_guide, sale_type, assigned_agent_id, vendor_id) VALUES
  ('e0000000-0000-0000-0000-000000000001', '42', 'Ocean Street', NULL, 'Bondi', 'NSW', '2026', 'house', 4, 2, 2, 450, 'active', 1800000, 'Contact Agent', 'auction', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003'),
  ('e0000000-0000-0000-0000-000000000002', '15', 'Crown Street', '3/15', 'Surry Hills', 'NSW', '2010', 'apartment', 2, 1, 1, NULL, 'active', 680000, '$680,000', 'private-treaty', 'b0000000-0000-0000-0000-000000000003', NULL),
  ('e0000000-0000-0000-0000-000000000003', '8', 'View Road', NULL, 'Mosman', 'NSW', '2088', 'house', 5, 3, 2, 650, 'pre-market', NULL, 'Price Guide $2.8M - $3.0M', 'auction', 'b0000000-0000-0000-0000-000000000003', NULL);

-- ─── Transactions ───────────────────────────────────────────────────
INSERT INTO transactions (id, contact_id, property_id, pipeline_type, current_stage, assigned_agent_id) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', NULL, 'buying', 'active-search', 'b0000000-0000-0000-0000-000000000002'),
  ('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', NULL, 'buying', 'qualified-lead', 'b0000000-0000-0000-0000-000000000002'),
  ('f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'selling', 'on-market', 'b0000000-0000-0000-0000-000000000003'),
  ('f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004', NULL, 'buying', 'property-shortlisted', 'b0000000-0000-0000-0000-000000000003');

-- ─── Activities ─────────────────────────────────────────────────────
INSERT INTO activities (contact_id, type, title, description, created_by) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'call', 'Initial discovery call', 'Discussed budget, preferences. Pre-approved for $1.1M. Looking in Eastern Suburbs.', 'b0000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000001', 'property-sent', 'Sent 5 property matches', 'Properties in Bondi, Coogee matching criteria', 'b0000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000001', 'inspection', 'Inspected 42 Ocean St, Bondi', 'Very interested. Wants to do second inspection.', 'b0000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000003', 'meeting', 'Appraisal meeting', 'Met vendor at property. Discussed market conditions and pricing strategy.', 'b0000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000004', 'open-home', 'Attended open home at 8 View Rd', 'Loved the property. Wants to come back for private inspection.', 'b0000000-0000-0000-0000-000000000003');

-- ─── Tasks ──────────────────────────────────────────────────────────
INSERT INTO tasks (title, type, priority, status, contact_id, assigned_to, due_date, created_by) VALUES
  ('Call Michael re: second inspection of 42 Ocean St', 'call', 'high', 'pending', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', NOW() + INTERVAL '1 day', 'b0000000-0000-0000-0000-000000000002'),
  ('Send property shortlist to Priya', 'email', 'medium', 'pending', 'd0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', NOW() + INTERVAL '2 days', 'b0000000-0000-0000-0000-000000000002'),
  ('Prepare vendor report for David Williams', 'general', 'high', 'pending', 'd0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', NOW() + INTERVAL '3 days', 'b0000000-0000-0000-0000-000000000003'),
  ('Schedule private inspection for Lisa at 8 View Rd', 'inspection', 'high', 'pending', 'd0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003', NOW() + INTERVAL '1 day', 'b0000000-0000-0000-0000-000000000003');
