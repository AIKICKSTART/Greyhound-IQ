# Payment-card scope

GreyhoundIQ currently uses authenticated, server-created Stripe Checkout and Stripe Customer Portal sessions. The application selects prices on the server and redirects the browser to Stripe; GreyhoundIQ forms, API routes, application logs and database models do not collect or persist payment-card numbers, CVCs or expiry values.

Plan and entitlement changes are applied only after the signed Stripe webhook is verified. Browser success and cancellation returns are informational.

This is a source-bound scope decision, not a PCI DSS compliance attestation. Security review must reopen the PCI scope gate before introducing direct card fields, embedded payment components, server-side card-data handling, another payment provider, or payment data in logs/analytics/support tooling.
