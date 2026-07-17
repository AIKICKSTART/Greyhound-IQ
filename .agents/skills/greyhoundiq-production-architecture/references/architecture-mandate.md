# Production architecture review mandate

Use this reference when producing or reviewing GreyhoundIQ's full production plan. Keep the report auditable; do not expose hidden chain-of-thought.

## Evidence model

Label every material statement as one of:

- `fact`: observed in the current repository, an authorised environment, or current first-party documentation;
- `assumption`: numbered `A-###`, with posture, sensitivity, validation and owner;
- `selected`: approved target architecture, not deployment evidence;
- `unverified`: a target without a passing command, immutable artifact, environment, timestamp and result;
- `residual risk`: accepted exposure with owner and milestone.

Begin with one consolidated missing-input list, but continue with low, expected and high scenarios. A user count alone never determines compute.

## Component pre-mortem

For every edge, gateway, compute, data, cache, queue, storage, identity, provider and control-plane component, record:

1. purpose and owned responsibility;
2. normal, peak and overload workload;
3. total, slow, stale and incorrect-response failure behaviour;
4. retry-storm and attacker-cost paths;
5. failure domain and single-point status;
6. metric, log, trace or synthetic detection and target time;
7. automatic containment and manual control;
8. recovery procedure, test, owner and residual risk.

Convert concerns into thresholds, kill switches, runbooks and tests.

## Required workload model

Calculate all combinations for:

- A: 50,000 registered users, 5% peak concurrency = 2,500;
- B: 50,000 active users, 20% peak concurrency = 10,000;
- C: 50,000 simultaneous users as a stress sensitivity;
- dynamic requests per active user per minute = 2, 6 and 12;
- legitimate burst multiplier = 1x, 3x and 10x.

Show API RPS, cache-adjusted origin RPS, in-flight requests, symbolic CPU and replica demand, memory, DB operations, pooled connections, worker concurrency, bandwidth, transfer, logs and persistent-connection/reconnect sensitivity. Never turn provisional CPU-time or cache assumptions into measured capacity.

## Required failure and acceptance scope

Evaluate the 28 mandatory conditions: normal and burst traffic; 50k connections; L3/L4 and L7 attack; credential stuffing; expensive-route, cache-miss and cost-exhaustion abuse; instance, zone, database, cache, queue, identity, provider, deployment, leak, pool, DNS/certificate, credential, administrator, region, data-corruption and observability failures; plus combined failures.

Every condition needs user mode, detection target, alert, automatic and manual response, recovery, RPO, residual risk and proof test. Apply pass, conditional pass or fail to the 20 production acceptance tests. Conditional means the exact missing evidence is a launch blocker.

## Report order

Use this fixed 30-section order so Design Lab and exported HTML remain comparable:

1. executive verdict;
2. known facts, assumptions and missing inputs;
3. critical user journeys and workload classes;
4. service objectives;
5. traffic and workload model;
6. 50,000-user capacity calculations;
7. architecture diagrams;
8. component architecture;
9. CDN, WAF, bot and DDoS;
10. API gateway and load balancing;
11. compute and autoscaling;
12. backend application;
13. database and data;
14. cache;
15. queues and workers;
16. network and trust boundaries;
17. authentication and authorisation;
18. threat model;
19. redundancy and failure analysis;
20. observability and alerting;
21. deployment and rollback;
22. backup and disaster recovery;
23. incident runbooks;
24. load, stress, failure and security tests;
25. cost analysis;
26. architecture decisions;
27. implementation roadmap;
28. adversarial senior review;
29. residual-risk register;
30. final go/no-go checklist.

Include Mermaid diagrams for system context, regional/AZ deployment, authenticated request, upload, asynchronous job, database/regional recovery, and DDoS/overload control.

## Completion rule

The plan may select a target while the release remains `not ready`. Do not call it production-ready until benchmarks, API security, origin blocking, one-zone capacity, safe deployment, database failover/restore, alert delivery, incident controls and regional recovery have executable passing evidence bound to the exact candidate.
