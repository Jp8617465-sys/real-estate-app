---
status: accepted
---

# Python back end, TypeScript front end, joined only by the documented API

Agreed with James on 7 November 2026. One Python back-end application owns the domain, the database, conversation extraction and the documented product API. A TypeScript web front end talks to it only through that API, using a client generated from the API's machine-readable description, so no type is written by hand on both sides. Python was chosen for extraction, evaluation and property-data work; the front end is simply the API's first consumer, which keeps the north star's "documented product API" honest from day one.

**Considered options:** TypeScript everywhere (one language, shared types, as in the retired RealFlow stack), rejected because extraction, evaluation and data tooling are stronger in Python and the API must be designed for outside consumers anyway. Separate microservices, rejected at this size: the back end is one deployable split into domain modules.
