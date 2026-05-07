# TampaRestore — Master Operations Guide

Last Updated: May 6, 2026
Owner: Tyler B.

---

## WHAT THIS BUSINESS DOES

TampaRestore is a free referral service connecting Tampa Bay homeowners with licensed, insured water damage restoration contractors. Leads are generated via the website, captured, and routed to contractor partners who pay $75/lead or $500/mo.

---

## CURRENT TECH STACK (100% FREE)

| Component | Tool | Cost | Status |
|-----------|------|------|--------|
| Website | GitHub Pages / Netlify | Free | ✅ Ready |
| Form Lead Capture | Netlify Forms | Free | ✅ Ready |
| Admin Email | tylerbelislefl@gmail.com | You get lead notifications |
| Contractor Email | ctbelisle@gmail.com | Gets forwarded leads |
| Database | Google Apps Script | Free | ⚠️ Setup |
| Auto-forward | Gmail Filter | Free | ⚠️ Enable |
| Dashboard | admin-4829.html | Free | ✅ Ready |
| Phone | Google Voice | Free | ⏳ Later |

---

## COMPLETE SETUP STEPS

### STEP 1: ENABLE NETLIFY EMAIL NOTIFICATIONS

1. Go to Netlify Dashboard → Your site → Forms
2. Click "Form Notifications" → Add Email Notification
3. Enter: tylerbelislefl@gmail.com
4. Save

Now every form submission emails you instantly.

### STEP 2: SETUP GMAIL AUTO-FORWARD

You get the email. To auto-forward to contractor:

1. Go to Gmail → Settings → Filters
2. Create filter:
   - Subject: contains "[Netlify]"
3. Add action: Forward to ctbelisle@gmail.com

Or manual forward:

1. Go to Gmail → Settings → Filters
2. Create filter:
   - Subject: contains "[Netlify]"
3. Add action: Forward to ctbelisle@gmail.com

### STEP 4: UPDATE FORM (Optional)

After Apps Script is deployed, update form to also submit to Google Sheet.

---

## FILES IN PROJECT

```
/Users/tylerbelisle/TampaRestore/
├── index.html                      ← Main site
├── admin-4829.html               ← Admin dashboard
├── MASTER.md                    ← This file
├── APPS_SCRIPT_SETUP.md         ← Database setup guide
├── status.md                   ← Current status
└── google-apps-script/
    └── Code.js                 ← Apps Script code
```

---

## LEAD FLOW

```
Homeowner submits form
         ↓
1. Netlify Forms captures → Dashboard shows
2. Netlify emails YOU → ctbelisle@gmail.com
3. Gmail auto-forward (if set) → contractor
4. Contractor calls homeowner
5. 💰 Get paid
```

---

## DASHBOARD

- URL: /admin-4829.html
- Password: TampaRestore2026!
- Features: Leads list, Revenue tracking, Analytics

---

## COSTS

| Service | Cost |
|---------|------|
| Netlify | $0 |
| Google Sheets | $0 |
| Gmail | $0 |
| Google Voice | $0 |
| **Total** | **$0** |

---

## WHAT'S READY TO DEPLOY

- ✅ index.html (updated with geolocation)
- ✅ admin-4829.html (dashboard)
- ✅ Netlify config
- ⚠️ Need: Netlify email setup
- ⚠️ Need: Apps Script deployment
- ⚠️ Need: Gmail filter

---

*Keep this updated.*