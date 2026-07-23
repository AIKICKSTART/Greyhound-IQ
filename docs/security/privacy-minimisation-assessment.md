# Privacy minimisation assessment

Status: source-verified; legal approval and deployed retention proof remain separate gates  
Owner: Privacy, security and application engineering  
Review date: 2026-07-15

GreyhoundIQ applies minimisation to the complete source-derived personal-information inventory, not only account-profile fields. The reviewed set contains 141 database columns that contain or link personal information and nine third-party processing boundaries. Every record has a unique stated purpose, collection source, required/optional status, visibility boundary, retention/deletion decision and owner.

Collection is allowed under three explicit rules. A schema-required field may be collected only to create the named persisted record. A schema-optional field is collected only when the user or an authorised workflow invokes the owning feature. Personal information sent to a provider is collected or disclosed only when that provider-backed feature is invoked. Adding a schema field or personal-data provider changes the inventory and fails the exact-count/coverage tests until it receives a decision.

No record may use “future”, “maybe”, “potential”, “later”, “TBD”, “unknown” or “just in case” as its purpose. Future use is false for every decision. Secondary analytics and AI use are prohibited by default and require a separately approved, disclosed and minimised purpose. Raw values remain prohibited in application logs; the logger redaction policy is a separate executable control.

This assessment does not declare every legal basis approved, prove provider contracts or Australian data residency, prove deployed retention jobs, or replace a formal Privacy Impact Assessment before public production. Those unknowns remain explicit in the personal-information records and production gate. The immediate removal backlog is to challenge optional fields with no observed feature use after real staging telemetry exists; absence of observed use must lead to removal or a documented operational need, not indefinite collection.
