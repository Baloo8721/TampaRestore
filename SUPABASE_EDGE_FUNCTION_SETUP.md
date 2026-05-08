# TampaRestore - Supabase Edge Function Setup

## What This Does
- Form submits to Supabase Edge Function (no keys in browser code)
- Edge Function writes to database
- Edge Function sends emails via Resend

---

## Step 1: Set Environment Variables in Supabase

Go to Supabase Dashboard → Settings → Edge Functions

Add these secrets:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | Your project URL (e.g., https://abc123.supabase.co) |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key (from API settings) |
| `SUPABASE_ANON_KEY` | Your anon key |
| `RESEND_API_KEY` | Your Resend API key |
| `CONTRACTOR_EMAIL` | ctbelisle@gmail.com |
| `ADMIN_EMAIL` | tylerbelislefl@gmail.com |

---

## Step 2: Deploy Edge Function

In your local terminal:

```bash
# Install Supabase CLI first if you don't have it
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy submit-lead
```

Or do it via Supabase Dashboard:
1. Go to Edge Functions
2. Create new function
3. Paste code from `supabase/functions/submit-lead.ts`

---

## Step 3: Get Your Edge Function URL

After deploying, you'll get a URL like:
`https://abc123.supabase.co/functions/v1/submit-lead`

---

## Step 4: Update Website Code

Open `index.html` and replace:
```
YOUR_SUPABASE_EDGE_FUNCTION_URL_HERE
```
with your actual Edge Function URL.

---

## Step 5: Enable GitHub Pages

1. Go to your GitHub repo → Settings → Pages
2. Select "main" branch
3. Save

Your site will be at: `https://yourusername.github.io/TampaRestore/`

---

## Step 6: Update Admin Dashboard

The admin dashboard (`admin-4829.html`) already uses localStorage for credentials - no changes needed there.

When you first use the admin, you'll enter your Supabase URL and anon key once (saved in browser).

---

## Security

- ✅ Keys are in Supabase Edge Function - NOT in your GitHub code
- ✅ Only the Edge Function URL is public
- ✅ Anon key not exposed to browsers

---

## Test It

1. Submit a form on your site
2. Check your email for lead notification
3. Check Supabase dashboard for new lead
4. Check admin dashboard