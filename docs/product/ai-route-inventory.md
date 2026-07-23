# GreyhoundIQ AI route inventory

Status: source-static route inventory complete; live-provider execution remains unproven  
Snapshot: 2026-07-15 AEST  
Owner: Product engineering

## Registered user and operator surfaces

| Route | Responsibility | Registry status |
| --- | --- | --- |
| `/agents` | Agent catalogue, tier-gated run configuration, recent user-owned run history, status presentation, and supported cancellation | Registered |
| `/account` | User-data export entry point that includes the member's agent runs | Registered |
| `/account/billing` | Agent-run entitlement and usage summary | Registered |
| `/admin/jobs` | Read-only operational status for agent runs and agent-run usage without prompts or outputs | Registered |

GreyhoundIQ does not currently expose separate agent-session, agent-history, or agent-configuration pages. Run history and configuration are deliberately contained in `/agents`; operational history is contained in `/admin/jobs`. No navigation entry advertises a standalone route that does not exist.

## Registered API and internal surfaces

| Method | Route | Responsibility |
| --- | --- | --- |
| `POST` | `/api/agents/[type]/run` | Start an allowlisted agent type for the authenticated user |
| `GET` | `/api/agents/context` | Read the authenticated user's bounded agent context |
| `GET` | `/api/agents/runs` | List the authenticated user's bounded run history |
| `GET` | `/api/agents/runs/[id]` | Read one user-owned run |
| `POST` | `/api/agents/runs/[id]/cancel` | Cancel one supported user-owned run |
| `GET` | `/api/memory` | List user-owned memory records |
| `POST` | `/api/memory` | Create a validated user-owned memory record |
| `GET` | `/api/memory/[id]` | Read one user-owned memory record |
| `DELETE` | `/api/memory/[id]` | Delete one user-owned memory record |
| `POST` | `/api/memory/[id]/supersede` | Supersede one user-owned memory record |
| `POST` | `/api/internal/memory-decay` | Run authenticated internal memory maintenance |

The `/agents` page also uses the server action `createAgentRun`; this is an application mutation surface rather than a separate browser route.

## Evidence boundary

The focused inventory test discovers the route handlers from source, verifies the four related screen routes against the canonical screen registry, and checks that the supported catalogue and the `/agents` page expose catalogue, configuration, history, status, and cancellation surfaces. It does not prove live execution, provider availability, browser rendering, database contents, tenant isolation, deployment parity, or production readiness.
