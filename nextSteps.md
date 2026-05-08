# TampaRestore - Next Steps

Last Updated: May 8, 2026

---

## ✅ What's DONE

| Component | Status |
|-----------|--------|
| Website (index.html) | ✅ Ready - hosted on GitHub Pages |
| Lead Form + Geolocation | ✅ Working |
| Supabase Database | ✅ Stores leads |
| Edge Function (submit-lead) | ✅ Receives form, saves to DB |
| Edge Function (send-email) | ✅ Sends emails to contractor + admin |
| Gmail SMTP | ✅ Both emails now working |
| Admin Dashboard | ✅ Works (password: TampaRestore2026!) |

---

## Current Lead Flow (Working)

```
Homeowner submits form
    ↓
1. index.html sends to Supabase Edge Function
2. Edge Function writes lead to Supabase DB
3. Edge Function sends email to contractor (ctbelisle@gmail.com)
4. Edge Function sends email to admin (tylerbelislefl@gmail.com)
5. Contractor calls homeowner
6. 💰 Get paid
```

---

## 📋 What's LEFT

### High Priority
- [ ] Test dashboard - verify admin-4829.html fetches real data from Supabase

### Marketing / SEO (from SEO_LEAD_GEN_PLAN.md)
- [ ] Phase 1: Google Business Profile setup
- [ ] Phase 1: Get Google Voice number (813 area code)
- [ ] Phase 1: Ensure NAP consistency across directories

### Website SEO
- [ ] Phase 2: Create service pages (water-damage.html, flood.html, mold.html, etc.)
- [ ] Phase 2: Create location pages (tampa.html, wesley-chapel.html, etc.)
- [ ] Phase 2: Add schema markup
- [ ] Phase 3: Add blog content / FAQ

### Business Growth
- [ ] Phase 4: Reviews strategy (request after each job)
- [ ] Phase 5: Directory citations (Yelp, HomeAdvisor, Angi, BBB)
- [ ] Phase 7: Referral partnerships (insurance agents, plumbers, property managers)

### Later / Optional
- [ ] Google Voice setup for call tracking

---

## Quick Wins (Today)

1. **Test dashboard** - Open admin-4829.html, verify it shows real leads from Supabase
2. **Submit test form** - Verify emails arrive at both addresses

---

## Resources

| Task | URL |
|------|-----|
| Google Business Profile | business.google.com |
| Google Voice | voice.google.com |
| Supabase Dashboard | supabase.com |
| GitHub Pages | pages.github.com |

---

*Keep this file updated as we progress.*