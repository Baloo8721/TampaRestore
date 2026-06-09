-- Add Stripe payment fields to contractors
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS auto_pay BOOLEAN DEFAULT false;
UPDATE contractors SET auto_pay = false WHERE auto_pay IS NULL OR auto_pay = true;

-- Commissions table for tracking payments
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

CREATE POLICY "Public can read commissions" ON commissions FOR SELECT USING (true);
CREATE POLICY "Public can insert commissions" ON commissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update commissions" ON commissions FOR UPDATE USING (true);
