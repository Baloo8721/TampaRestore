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
| Website | GitHub Pages | Free | ✅ Ready |
| Form Lead Capture | Supabase Edge Function | Free | ✅ Ready |
| Database | Supabase | Free | ✅ Ready |
| Email Notifications | Gmail SMTP (App Password) | Free | ✅ Ready |
| Admin Dashboard | admin-4829.html | Free | ✅ Ready |
| Phone | Google Voice | Free | ⏳ Later |

---

## COMPLETE SETUP STEPS

### Everything is set up!

1. **Website** → GitHub Pages
2. **Form submits to** → Supabase Edge Function (`submit-lead`)
3. **Edge function** → Writes to Supabase DB + sends emails via Gmail SMTP
4. **Contractor** → Gets email at ctbelisle@gmail.com
5. **Admin** → Gets email at tylerbelislefl@gmail.com

No manual setup needed!

---

## FILES IN PROJECT

```
/Users/tylerbelisle/TampaRestore/
├── index.html                      ← Main site
├── admin-4829.html                 ← Admin dashboard
├── MASTER.md                      ← This file
├── status.md                      ← Current status
├── supabase/
│   ├── functions/
│   │   ├── submit-lead.ts        ← Form handler + emails
│   │   ├── send-email.ts         ← Email helper
│   │   └── get-leads.ts          ← Admin data fetch
│   └── schema.sql                ← DB schema
└── google-apps-script/
    └── Code.js                   ← Old - not used anymore
```

---

## LEAD FLOW

```
Homeowner submits form
         ↓
1. index.html → Supabase Edge Function (submit-lead)
2. Edge Function writes lead to Supabase database
3. Edge Function (send-email) sends via Gmail SMTP:
   - Email to contractor (ctbelisle@gmail.com)
   - Email to admin (tylerbelislefl@gmail.com)
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

- ✅ index.html (form + geolocation)
- ✅ admin-4829.html (dashboard)
- ✅ Supabase Edge Functions (submit-lead, get-leads, send-email)
- ✅ Gmail SMTP email (both contractor + admin get notified)
- ✅ Supabase database

---

*Keep this updated.*