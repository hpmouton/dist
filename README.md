# Patrick & Michelle’s wedding website

Wedding invitation and guest information for 11 December 2026 at Eden Chalets, with a private RSVP dashboard.

## Start here: finish your Cloudflare setup

Follow **[RSVP-SETUP.md](RSVP-SETUP.md)** from Step 1 to Step 9. It covers the exact deployment error you encountered and includes the SQL to copy into your existing **makiti** database.

The guide walks through:

1. Adding the corrected files to your connected repository.
2. Matching your existing Cloudflare Worker name.
3. Setting the build root and deploy command.
4. Creating the database tables.
5. Deploying and checking the database binding.
6. Saving your private organiser key.
7. Checking the live connection.
8. Adding invitations and the RSVP deadline.
9. Testing a complete guest reply.

## Deployment files

| File | Purpose |
| --- | --- |
| `patrick-michelle-workers.zip` | Complete deployment package for your current Cloudflare Workers setup. Extract it into your repository; do not upload the ZIP itself as source. |
| `wrangler.jsonc` | Active Workers configuration, including the `makiti` database binding. |
| `dist/.assetsignore` | Keeps server code out of public static assets. |
| `migrations/0001_rsvp.sql` | Creates the RSVP tables without adding guests. |
| `patrick-michelle-wedding.zip` / `wrangler.pages.jsonc` | Legacy Pages workflow; not used by the current Workers setup. |

There is no frontend build step. The deployment command is `npx wrangler deploy`, run in the folder containing `wrangler.jsonc`. No deployment is performed by opening this project locally.

## Website files

- `dist/index.html`: invitation, programme, attire, venue directions, gifts and guest information.
- `dist/wedding-party.html`: wedding party portraits and roles.
- `dist/rsvp.html`: guest replies, reached through personal invitation links or codes.
- `dist/admin.html`: organiser dashboard for households, replies, deadlines and CSV exports.
- `dist/design.css` and `dist/rsvp.css`: responsive design and animations.
- `dist/script.js` and `dist/rsvp.js`: website and form interactions.
- `dist/_worker.js`: server-side RSVP validation and D1 database access.
- `dist/assets`: photographs and attire illustrations.

Guest pages play the supplied `assets/audio/song.mp3` on repeat, with play/pause and volume controls. Browsers may require a tap before playback. A guest’s pause and volume choices are remembered; the organiser page has no music. RSVP records live in the database, not in the public website files. There are no automated email notifications.

## Preview locally

With Node.js 24 or later, run `npm run dev` from this folder, then open `http://127.0.0.1:4173/`. The setup guide explains the local organiser key. Opening `dist/index.html` directly previews the design, but working RSVP submission requires a server.

## Verification

`npm test` checks the RSVP API against an isolated local SQLite database. The deployment configuration also passed a Cloudflare dry run. Follow Steps 7–9 of the setup guide to verify your actual hosted site before sending invitations.


Music stays connected during navigation between guest pages on the hosted site or local HTTP server. Use `npm run dev` to preview this behaviour; direct `file:///` previews use normal page loads because browsers restrict fetching local files. Full browser reloads, external sites and the organiser page still start a new document.


Dashboard: separate task views, filters, search, sorting and 12-household pagination; saved invitation codes with copy controls and restoration for older links. Programme: responsive vertical timeline with ceremony, cocktail/photo and celebration icons. Existing D1 tables support the changes without new SQL. Redeploy the updated Worker and website together.
