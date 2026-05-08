# ⚠️ DEPRECATED - Not Using Google Apps Script

Last Updated: May 8, 2026

---

We are no longer using Google Apps Script / Google Sheets for this project.

## Current Stack

- **Database**: Supabase (not Google Sheets)
- **Form Handler**: Supabase Edge Function (`submit-lead.ts`)
- **Email**: Resend API (called from edge function)

## Why We Switched

1. Supabase keeps API keys hidden (security)
2. Single system instead of two (form + sheet)
3. Edge functions handle everything in one place

---

*This file is kept for reference only.*