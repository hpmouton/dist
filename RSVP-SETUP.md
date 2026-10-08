# Wedding RSVP setup — follow these steps in order

This guide is for your existing **Cloudflare Worker**, the deployment that reported “Uploading a Pages _worker.js file as an asset”.

Your database is **makiti** (`d86802b0-ea87-4002-b300-18c41d8cda77`). The configuration has been corrected and Cloudflare's deployment dry run passed. The live deployment and database setup still need to be completed in your account.

## 1. Put the updated project in your connected repository

1. Extract **patrick-michelle-workers.zip** on your computer, or use the existing updated `wedding-site` folder.
2. Open the repository connected to your Cloudflare Worker.
3. Copy the extracted project files into that repository, replacing the earlier versions. Keep your existing photographs if you have added more.
4. Make sure you have this structure:

```text
project folder/
  wrangler.jsonc
  package.json
  migrations/
    0001_rsvp.sql
  dist/
    .assetsignore
    _worker.js
    index.html
    rsvp.html
    admin.html
    ...other website files and assets/
```

Keep `.assetsignore`, including its leading dot. Its contents must be:

```text
/_worker.js
/_routes.json
```

Use the **Workers** ZIP for this setup. Uploading just the ZIP file into your repository will not work: extract it and add its contents. The `patrick-michelle-wedding.zip` archive is for the older Pages upload workflow.

**Check:** `wrangler.jsonc` and `dist` are next to each other in the repository.

## 2. Match your Cloudflare Worker name

1. In Cloudflare, open **Workers & Pages** and select the Worker whose deployment failed.
2. Note its exact name at the top of the page. This is the website's Worker name, which can differ from the database name `makiti`.
3. Open `wrangler.jsonc` in your project and change only its `name` value if necessary:

```json
"name": "themoutonmakiti"
```

Your deployment log confirms the Worker is named `themoutonmakiti`, which is now set in the configuration. Change it only if you choose a different Worker. Keep the `main`, `assets` and `d1_databases` settings as supplied.

**Check:** the configured Worker name matches the existing Worker in Cloudflare. The database name remains `makiti`.

The compatibility date is set to `2026-10-06`. Keep this value; it selects runtime behaviour and does not need to match today’s local date.

## 3. Correct the Cloudflare build settings

In the same Worker, open **Settings → Build** and edit the build configuration:

| Setting | Value |
| --- | --- |
| Root directory | The repository folder containing `wrangler.jsonc` — see below |
| Build command | Leave empty |
| Deploy command | `npx wrangler deploy` |

Choose the root directory based on what you see in your repository:

- If the repository opens directly onto `wrangler.jsonc` and `dist`, use the repository root (`/`, or the default empty value).
- If it contains a `wedding-site` folder and the configuration is inside it, use `wedding-site`.

Save the settings. Remove any previous deploy command that only uploads `dist` as assets, such as `npx wrangler deploy --assets dist`.

**Check:** Cloudflare will run `npx wrangler deploy` from the directory containing the updated configuration. [Cloudflare build settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)

## 4. Create the RSVP tables in makiti

You only need to initialise the tables once. If you already ran this exact schema successfully, skip to Step 5.

1. In Cloudflare, open **Storage & databases → D1** (or find **D1** in the dashboard search).
2. Select **makiti**.
3. Open its **Console**.
4. Copy and run the SQL below. If the console accepts only one statement at a time, run each statement separately, ending at its semicolon.

```sql
CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  contact TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  attending TEXT NOT NULL DEFAULT 'pending' CHECK (attending IN ('pending','yes','no')),
  dietary TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS guests_invitation ON guests(invitation_id);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
```

These statements create missing tables and do not erase existing responses. They do not add any guests.

To check the result, run:

```sql
SELECT name FROM sqlite_master
WHERE type = 'table'
AND name IN ('invitations', 'guests', 'settings')
ORDER BY name;
```

**Check:** the result contains `guests`, `invitations` and `settings`.

## 5. Deploy the corrected files

1. Save your project changes, commit them to your connected repository and push to the branch Cloudflare builds for production. If editing through the repository website, use its **Commit changes** action.
2. Open your Worker in Cloudflare and watch the new build. If no build starts, use the available **Retry build** or new-build action for the updated commit.
3. Confirm that the log no longer reports `_worker.js` being uploaded as an asset.
4. Confirm that the deployment succeeds.
5. Open the Worker's **Bindings** view and check for **DB → makiti**. The supplied configuration creates this binding during deployment. `ASSETS` serves the website files.

If `DB` is missing, check that the build used the updated `wrangler.jsonc` from the correct root directory. The binding must be called `DB`, with both letters capitalised.

**Check:** the website opens at the live address shown by Cloudflare and the Worker has its `DB` binding. The organiser login is configured next.

## 6. Add your private organiser key

1. In that same Worker, open **Settings → Variables and Secrets → Add**.
2. Choose the type **Secret**.
3. Enter this variable name exactly: **ADMIN_KEY**.
4. Generate a random password of at least **32 characters** in your password manager and paste it as the value.
5. Save it in your password manager so you and Michelle can sign in later.
6. Select **Deploy** or complete the save-and-deploy action shown by Cloudflare so the secret is active on the live version.

Use the Worker's runtime **Variables and Secrets** section, not environment variables under the build settings. Keep the key out of your repository and public website files. This key is your organiser login; it is not an invitation code for guests.

**Check:** `ADMIN_KEY` appears as a secret on the Worker. Its value will be hidden after saving. [Cloudflare secret setup](https://developers.cloudflare.com/workers/configuration/secrets/)

## 7. Check the connection before adding guests

1. Copy the live website address shown by Cloudflare. Use that address for the following checks, replacing the example domain below.
2. Open `https://YOUR-WEBSITE/api/settings`.
3. With no deadline set, the page should show:

```json
{"deadline":""}
```

4. Open `https://YOUR-WEBSITE/admin.html`.
5. Enter your private `ADMIN_KEY` value and select **Open dashboard**.

**Check:** the dashboard opens with guest counts and the **Add an invitation** form. An empty guest list is expected before you add anyone.

## 8. Set your deadline and create invitations

1. In the dashboard, choose your date under **The closing date** and select **Save closing date**. Replies close at the end of that date in Namibia. Leave it blank only if you want replies to stay open.
2. Under **Add an invitation**, enter a household label, for example `The Mouton family`.
3. Enter each invited person's name on a separate line. Include children or plus-ones only when they are invited.
4. Select **Create invitation**.
5. Immediately copy and save the personal invitation link shown below the form.
6. Repeat for the other households.

New invitation codes are saved and displayed on each household row in **Guest list**. Use **Copy code** or **Copy link** at any time. For older invitations, expand **Guest replies & invitation details**, paste a previously saved link or code, and select **Restore code**. This keeps the existing link valid. If you do not have it, **Replace invitation code** creates a new one and disables the old link without removing saved replies.

Guests can open their personal link directly. Alternatively, the text after `#invite=` in that link is their invitation code for the RSVP page. Send each link privately to its household, since it allows access to that household's reply.

**Check:** each household appears in your list with the correct invited names.

## 9. Test one real invitation before sharing the site

Use a real invited household whose response you can enter accurately, with their agreement. There is no delete button for disposable test households in the current dashboard.

1. Copy that household's invitation link.
2. Open it in a separate private/incognito browser window.
3. Check that only that household's invited names appear.
4. Choose accept or decline for each guest and add a dietary note if relevant.
5. Select **Send our reply** and wait for the saved confirmation.
6. Close that window, open the same link again and check that the reply is still there.
7. Return to the organiser dashboard and select **Refresh**.
8. Check the attending/declined counts and select **Download spreadsheet (CSV)** to verify the exported response.

**Finished:** you can now share the live site and each household's personal invitation link. Guests may update replies until the closing date. Reopening the organiser dashboard requires your key again.

## If something goes wrong

| What you see | What to check |
| --- | --- |
| “Uploading a Pages _worker.js file as an asset” | Steps 1–3: updated `wrangler.jsonc`, non-empty `dist/.assetsignore`, correct root directory, and deploy command `npx wrangler deploy`. Confirm the build uses your newest commit. |
| “Can't set compatibility date in the future” | Set `compatibility_date` to `2026-10-06` in `wrangler.jsonc`, commit and push, then retry the updated build. |
| Worker name mismatch | Match `name` in `wrangler.jsonc` to the existing Worker, then commit and push. |
| “RSVP is not available just yet” | Check the live Worker has the `DB` binding to `makiti`. |
| “We could not save or load your response” | Confirm all three tables exist in `makiti` from Step 4. If they do, inspect the Worker logs for the underlying database error. |
| “The organiser dashboard has not been configured yet” | Check `ADMIN_KEY` is a runtime secret of at least 32 characters on the live Worker version. |
| “Please enter the correct organiser access key” | Enter the saved secret value, without extra spaces. You can set a new secret in Cloudflare if you lost it. |
| “RSVP is not connected yet”, HTML at `/api/settings`, or an API 404 | Check the deployed config includes `main: dist/_worker.js` and `run_worker_first: ["/api/*"]`. Redeploy the complete project. |
| Local preview cannot save responses | A `file:///...` address cannot call the live API. Use your hosted website, or the local server below. |
| Invitation not found | Use that household's latest link. Generating a replacement disables its earlier link. |
| Replies are closed | Check the closing date in the organiser dashboard. |

## Optional: preview on your computer

From the full local project folder, with Node.js 24 or later installed, run:

```powershell
npm run dev
```

Open `http://127.0.0.1:4173/admin.html`. The local-only key is `local-preview-only-organiser-access-key`. Never use that example key on your live site.

Local replies are saved in `.local/rsvp.sqlite`, separately from Cloudflare. Preview invitations do not become live invitations. Stop the local server with Ctrl+C.

## What has already been verified

The Worker deployment dry run passed with `DB (makiti)` and `ASSETS`. Local tests covered saving and reloading replies, invitation isolation, deadlines, replacement links, failed-submission recovery, CSV downloads and mobile layouts. The live Cloudflare connection still needs the checks in Steps 7–9.

For this workflow use **Workers** and `wrangler.jsonc`. The legacy `wrangler.pages.jsonc` is retained only for a separate Pages deployment and is not needed for these steps.


## Dashboard update

Use the **Guest list**, **Add invitation** and **Settings** views to keep tasks separate. Guest list shows 12 invitations per page, with search by guest, household or saved code; response/dietary filters; and name, latest reply or awaiting-reply sorting. Expand a household to see each guest’s reply, dietary notes and contact/message details. Each household shares one invitation code. New and restored codes are stored in the existing database and returned only to authenticated organisers; no additional database migration is required. CSV exports include all guests and omit invitation access codes.
