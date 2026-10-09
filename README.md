# Veg_Basket_ERP
### Sales bill manual entry and WhatsApp sharing

Run `npm run db:migrate-sales-manual-items` against each deployment database before deploying this version. This additive migration preserves existing item references, copies existing item names into invoice rows and normalizes invoice item names to uppercase, and allows new rows to store a typed name without creating catalog items.

Sales creation/editing displays the selected customer's current ledger outstanding balance separately from invoice totals. Invoice amounts remain entered as line totals, with unit prices derived from quantity and amount.

Saved invoices offer **Send via WhatsApp**. The preparation dialog generates the existing invoice PDF, then offers native file sharing where supported and a WhatsApp chat link using the saved customer number. Native sharing requires HTTPS and a compatible device/browser; the user chooses WhatsApp and the recipient in the share sheet. Local UAE mobile numbers starting with 05 are normalized to +971; other numbers must include their country code.

The fallback uses an HS256-signed URL scoped to invoice sharing, expires after seven days, and renders the current saved invoice. Only this token-validated PDF GET route is public. The URL grants access to anyone possessing it; deleted invoices stop being available and rotating AUTH_SECRET invalidates all existing links. Deploy on a publicly reachable HTTPS origin for customers to open links.

Verification: `node scripts/check-sales-validation.mjs` checks create/edit validation without database writes. With a production server at localhost:3107 (or SALES_TEST_URL), `node --env-file=.env scripts/check-sales-sharing.mjs` checks authentication, actual ledger records, existing invoice names, PDF links and expiry without modifying sales or payments.

Item names are converted to uppercase during entry and validated/normalized by both Sales save endpoints. Next Item inserts and focuses within the click gesture to retain mobile keyboard activation, then smoothly reveals the field while tracking keyboard viewport changes. Reduced-motion preferences use immediate scrolling. Browser checks for this behavior are in scripts/check-sales-item-focus.mjs (requires Playwright, a running server, and AUTH_SECRET from .env); mobile keyboard changes are simulated and should also be checked on physical devices.

On mobile the Sales panel is anchored at the top with fixed outer bounds for the current orientation. Only its form content scrolls; the keyboard adjusts the visible content area rather than recentering the panel. Save stays in the form flow to avoid covering fields. Background scrolling is locked while the mobile Sales modal is open and restored when it closes. The browser check covers desktop plus 320px, 390px, and 430px widths with simulated keyboard changes.
