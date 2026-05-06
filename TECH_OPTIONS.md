# TampaRestore — Technical Options Review

**Last Updated:** May 2026  
**Status:** ✅ COMPLETE — Netlify Forms chosen and implemented

---
## CHOSEN SOLUTION

**Netlify + Netlify Forms** — Implemented in index.html

- ✅ Free, unlimited submissions
- ✅ Commercial OK
- ✅ No user extra clicks
- ✅ Already configured in code

---

## Project Goals

1. **Lead Collection:** Homeowner submits form → data goes to email (or straight to contractor)
2. **No 3rd Party dependency:** Prefer open source / custom code over paid APIs
3. **Free:** Zero ongoing costs
4. **Commercial ready:** Can use for business (not personal-only)
5. **Keep GitHub Pages:** Already hosting there, working

---

## Current Tech Stack

| Component | Tool | Status |
|-----------|------|--------|
| HTML/CSS | Vanilla | ✅ Built, working |
| JS | Vanilla | ✅ Built, working |
| Fonts | Google Fonts | ✅ Free |
| Hosting | GitHub Pages | ✅ Free, works |
| Form Handler | Formspree | ⚠️ Need config (3rd party) |

---

## Form Handler Options (All Free)

### Option 1: Keep Formspree
- **Cost:** Free (100 submissions/mo)
- **3rd Party:** Yes
- **Commercial:** No (free tier = personal only)
- **How it works:** Form → Formspree API → Your email
- **Setup:** Sign up, paste form ID in code
- **Works with:** GitHub Pages ✅

### Option 2: Netlify Forms
- **Cost:** Free (unlimited)
- **3rd Party:** Yes
- **Commercial:** Yes (OK for business)
- **How it works:** Form → Netlify → Your email (notifications)
- **Setup:** Switch hosting to Netlify, add attribute to form
- **Works with:** Needs Netlify hosting

### Option 3: Custom mailto: Link
- **Cost:** Free
- **3rd Party:** No (uses email client)
- **Commercial:** Yes
- **How it works:** User clicks submit → email app opens with data pre-filled → user clicks Send
- **Setup:** Replace fetch() with mailto: link in current code
- **Works with:** GitHub Pages ✅
- **Downside:** User does 1 extra click (Send in email app)

### Option 4: Form Backend Service (Basin, FormCarry, etc.)
- **Cost:** Free tier (limited)
- **3rd Party:** Yes
- **Commercial:** Most say yes on free, check terms
- **How it works:** Form → Their API → Your email
- **Works with:** GitHub Pages ✅

### Option 5: Server-Side (Resend, SendGrid API)
- **Cost:** Free tier (limited)
- **3rd Party:** Yes
- **Commercial:** Yes
- **How it works:** You need server code (Next.js API route, PHP, etc.) → Call Resend API → Email sent
- **Setup:** Requires backend, not for static-only sites
- **Works with:** GitHub Pages ❌ (needs server/function)

**Note on Resend:** Requires server-side code to call the API. Cannot use directly from static HTML. You'd need Vercel/Netlify functions or a VPS.

---

## Resend — Does It Work Here?

**Short answer:** No for static HTML site, unless you add server-side code.

Resend is an **email sending API**, not a form backend. To use it:
- Option A: Build Next.js app → Use Server Actions → Send via Resend API
- Option B: Use Vercel Functions → Call Resend

**What you'd need to change:**
1. Current static site → Full Next.js app
2. Add form API endpoint
3. Install Resend SDK
4. Deploy to Vercel (not GitHub Pages)

**Verdict for TampaRestore:** Overkill for a simple static lead form.

---

## Recommendations (Priority Order)

### Best for Your Goals (Keep GitHub Pages, Free, Commercial)

**Option A: Switch to Netlify + Netlify Forms**
1. Switch hosting: GitHub Pages → Netlify (free, deploy from same repo)
2. Add `netlify` attribute to form
3. Enable email notifications in Netlify dashboard
4. **Pros:** Free, unlimited, commercial OK, no code changes
5. **Cons:** Need new account, switch hosting

**Option B: Custom mailto: Link**
1. Change current form to use `mailto:your@email.com?subject=New Lead&body=...`
2. No 3rd party signup
3. **Pros:** No dependencies, free, yours
4. **Cons:** User clicks Send in email app (1 extra step)

### Less Recommended for Your Case
- Formspree (not commercial-friendly on free tier)
- Resend (requires server-side, overkill for this)
- Add backend just for form (not worth $6+/mo)

---

## What You Have (Accounts/Tools)

| Tool | You Have? | Notes |
|------|-----------|-------|
| GitHub | ✅ Yes | Hosting on Pages |
| Google Voice | Need | Free, get at voice.google.com |
| Resend | Could use | Transactional email API only, needs server |
| Netlify | Not yet | Free, good alternative |

---

## Decision Needed

**Question 1:** Do you want to keep GitHub Pages or switch hosting?

**Question 2:** Which form option do you prefer?
- A) Switch to Netlify → Use Netlify Forms (free, no extra clicks)
- B) Keep GitHub Pages → Use mailto: (free, no 3rd party, 1 extra click)
- C) Stay on GitHub Pages → Sign up Formspree anyway (easiest setup)

---

## Once You Decide, Next Steps

### If Choose Option A (Netlify + Netlify Forms)
1. Create Netlify account
2. Connect GitHub repo
3. Deploy automatically
4. Add `data-netlify="true"` to form tag in index.html
5. Enable email notifications
6. Test form submission

### If Choose Option B (mailto: Link)
1. Give me your business email
2. I'll update the form code (mailto: link replaces fetch)
3. Test submitting

### If Choose Option C (Formspree)
1. Sign up at formspree.io
2. Create form, get form ID
3. I'll add form ID to index.html line 1133
4. Test

---

**Goal:** Get leads → Your email → Route to contractor → Get paid

Let me know which option you prefer, and I'll make it happen.