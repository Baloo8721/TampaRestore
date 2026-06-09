Step 1: Run the SQL Migration
1. Go to https://supabase.com/dashboard/project/aqafvfzsybcqfxqklqsd
2. Click SQL Editor in the left sidebar
3. Click New Query
4. Paste the entire contents of supabase/migrations/006_commissions.sql — here it is:
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS auto_pay BOOLEAN DEFAULT true;

CREATE TABLE IF NOT EXISTS commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  contractor_email TEXT NOT NULL,
  trade TEXT,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_commissions_contractor ON commissions(contractor_email, status);
CREATE INDEX IF NOT EXISTS idx_commissions_lead ON commissions(lead_id);
ALTER PUBLICATION supabase_realtime ADD TABLE commissions;
5. Click Run — done.
Step 2: Deploy contractor-action (this is the one sending the "Mark Complete" email)
1. In the same project, click Edge Functions in the left sidebar
2. Click contractor-action (if exists) or Create a new function
3. Delete the old code, paste the full contents of supabase/functions/contractor-action/index.ts (I can show it to you)
4. Click Deploy
Step 3: Deploy send-email
1. Click send-email function (or create it)
2. Replace with code from supabase/functions/send-email/index.ts
3. Click Deploy
Step 4: Deploy complete-job
1. Create a new function called complete-job
2. Paste code from supabase/functions/complete-job/index.ts
3. Click Deploy
Step 5: Deploy stripe-webhook
1. Create a new function called stripe-webhook
2. Paste code from supabase/functions/stripe-webhook/index.ts
3. Click Deploy
Step 6: Set Secrets
In Edge Functions → Secrets (or Settings → API):
- Add STRIPE_SECRET_KEY = sk_live_... (your Stripe secret key)
- Add STRIPE_WEBHOOK_SECRET = whsec_... (generate in Stripe Dashboard → Webhooks)
Step 7: Configure Stripe Webhook
In Stripe Dashboard → Developers → Webhooks → Add endpoint:
- Endpoint URL: https://aqafvfzsybcqfxqklqsd.supabase.co/functions/v1/stripe-webhook
- Events: checkout.session.completed, payment_intent.succeeded, payment_intent.payment_failed
- Click Signing secret and copy the whsec_... value into the STRIPE_WEBHOOK_SECRET secret above
Want me to show you the exact code for each function so you can copy-paste from here?
▣  Build · DeepSeek V4 Flash Free · 44.0s