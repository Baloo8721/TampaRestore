# TampaRestore — Current Status

Last Updated: May 6, 2026

---

## BUILD STATUS

| Component | Status | Next Step |
|-----------|--------|----------|
| index.html | ✅ Ready | Deploy |
| admin-4829.html | ✅ Ready | Deploy |
| Netlify Forms | ✅ Configured | Enable email |
| Google Apps Script | ⚠️ Need setup | Follow APPS_SCRIPT_SETUP.md |
| Gmail Filter | ⚠️ Need setup | Manual setup |

---

## FILES READY TO DEPLOY

```
index.html                  - Main site with form + geolocation
admin-4829.html           - Dashboard (demo data for now)
netlify.toml              - Netlify config
package.json             - Dependencies
```

---

## ⚡ ACTIONABLE NEXT STEPS (IN ORDER)

### Step 1: Enable Email Notifications (2 min)

1. Go to Netlify Dashboard
2. Find your site → Forms tab
3. Click "Form Notifications"
4. Add "Email Notification" → tylerbelislefl@gmail.com
5. Save

Now form submissions email you automatically.

### Step 2: Set Up Google Sheets Database (10 min)

Follow: APPS_SCRIPT_SETUP.md

1. Open your Google Sheet (link in project)
2. Add column headers (A-K)
3. Extensions → Apps Script
4. Paste code from google-apps-script/Code.js
5. Deploy as Web App ("Anyone" access)
6. Save the URL

### Step 3: Set Up Gmail Auto-Forward (2 min)

1. Gmail → Settings → Filters
2. Create filter:
   - From: contains "noreply@netlify.com" OR
   - Subject: contains "water-damage-lead"
3. Actions: Forward to ctbelisle@gmail.com

### Step 4: Test

Submit a test form → check email → verify leads come in

---

## CURRENT AUTOMATION FLOW

```
Form → Netlify Forms → Email to YOU
```

Manual for now until Apps Script is set up.

---

## DASHBOARD

URL: /admin-4829.html
Password: TampaRestore2026!

---

## WHAT YOU NEED FROM ME

- Apps Script URL from Step 2
- I'll update dashboard to fetch real data
- I'll update form to also submit to Sheet

---

*Ready to deploy.*