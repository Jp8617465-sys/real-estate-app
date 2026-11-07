---
status: accepted
---

# One shared PostgreSQL database; every record belongs to an agency

Agreed with James on 7 November 2026. All agencies share one PostgreSQL database. Every agency-owned record carries its agency, and the database itself enforces that one agency can never read or change another's records, rather than relying on application code alone. This applies from the first single-user tracer bullet so that serving many small agencies never needs a rewrite. PostgreSQL also leaves room for spatial queries when mapping arrives.

**Considered options:** a database per agency (strong isolation, but costly to run and migrate across many small agencies); SQLite for the local tracer bullet (simpler at first, then a forced migration); Supabase (part of the retired stack).
