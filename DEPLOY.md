# TampaRestore — Complete Deployment Guide

Last Updated: May 6, 2026

---

## 🏗️ DEPLOY STEPS

### 1. Set Environment Variables in Netlify

Go to Netlify Dashboard → Your Site → Site Settings → Environment Variables

Add these:

| Variable | Value |
|----------|-------|
| RESEND_API_KEY | re_xxxxx (from resend.com) |
| CONTRACTOR_EMAIL | ctbelisle@gmail.com |

### 2. Deploy

In Netlify:
- Connect your GitHub repo
- Deploy settings:
  - Build command: `npm install && npm run build`
  - Publish directory: `.`
  - Functions directory: `netlify/functions`

### 3. Test

1. Go to your site URL
2. Fill out the form
3. Check your email (ctbelisle@gmail.com)
4. You should get an email within seconds

### 4. Access Dashboard

- URL: `yoursite.netlify.app/admin-4829.html`
- Password: `TampaRestore2026!`

---

## 📁 FILES IN PROJECT

```
index.html                    ← Main site (form + geolocation)
admin-4829.html            ← Admin dashboard
netlify.toml                ← Netlify config
netlify/
  functions/
    submit-lead.js         ← Auto-forward function
package.json              ← Dependencies
.env.example             ← Environment variables template
MASTER.md               ← Operations guide
```

---

## 🔧 IF YOU WANT TO ADD GOOGLE SHEETS

1. Create a Google Cloud Project
2. Enable Google Sheets API
3. Create Service Account + download JSON key
4. Share your sheet with the service account email
5. Add to `submit-lead.js`:
```javascript
const { GoogleSpreadsheet } = require('google-spreadsheet');
const creds = require('./service-account-key.json');
// ... init and append row
```

---

## 💰 COSTS

| Service | Cost |
|---------|------|
| Netlify | $0 |
| Resend (3k/mo) | $0 |
| Google Sheets | $0 |
| Google Voice | $0 |
| **Total** | **$0** |

---

## 🚀 AUTOMATION FLOW

```
Homeowner submits form
         ↓
Netlify Forms captures
         ↓
submit-lead.js runs
         ↓
Email to ctbelisle@gmail.com
         ↓
Contractor calls homeowner
         ↓
💰 Get paid
```

---

*Deploy, test, and start getting leads!*