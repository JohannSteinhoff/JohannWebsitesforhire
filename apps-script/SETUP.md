# Contact form setup (Google Apps Script)

The contact form on the site POSTs to a Google Apps Script Web App that runs
in your own Google account. For each submission it:

- flags obvious spam using a hidden honeypot field,
- appends a row to a Google Sheet in your Drive (labeled `real` or `BOT`), and
- emails you the real inquiries (with the customer's address as Reply-To).
  Bot submissions are logged but **not** emailed.

Free, no third-party service, no real submission limit.

## One-time setup (~3 minutes)

1. Go to **https://script.google.com** → **New project**.
2. Delete the starter code and paste in the contents of **`Code.gs`** from this
   folder. Confirm `NOTIFY_EMAIL` at the top is your email.
3. Click **Deploy → New deployment**.
   - Gear icon → **Web app**.
   - **Description:** anything (e.g. "contact form").
   - **Execute as:** **Me**.
   - **Who has access:** **Anyone**.  ← required, or the browser POST is rejected.
4. Click **Deploy**, then **Authorize access** and approve the permissions
   (it needs to send email *and* create/edit a spreadsheet as you). You may
   have to click *Advanced → Go to project (unsafe)* — that's expected for your
   own script.
5. Copy the **Web app URL** — it ends in `/exec`.

## Wire it into the site

In **`script.js`**, find:

```js
const APPS_SCRIPT_URL = 'YOUR_DEPLOYMENT_URL';
```

and replace `YOUR_DEPLOYMENT_URL` with the `/exec` URL you copied. Commit and
push — the form is now live.

## Test it

Open the site, submit the form, and check your inbox. You can also open the
`/exec` URL directly in a browser; it should say *"Contact form endpoint is
live."*

## Where the submissions are saved

On the **first** submission the script automatically creates a spreadsheet
in your Google Drive named **"Website Contact Form Submissions"** with columns
*Timestamp · Type · Name · Business · Email · Message*, and appends a row for
every submission after that. The **Type** column reads `real` or `BOT`, so you
can see (and filter out) honeypot-flagged spam at a glance — bot rows even
include the value the bot tried to inject. It remembers that sheet, so it always
uses the same one. (Find it at **drive.google.com** or **sheets.google.com**.)

To use a spreadsheet you already made instead, open it, copy its ID from the
URL, and in the Apps Script editor go to **Project Settings → Script Properties**
and add a property `SHEET_ID` = that ID.

## Notes

- **Editing the script later:** after any change to `Code.gs`, you must
  **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**
  for the change to take effect. The `/exec` URL stays the same.
- **Spam:** a hidden honeypot field (`company_website`) is already in place —
  bots that fill it are silently dropped. If junk still gets through, ask and
  I'll add reCAPTCHA.
