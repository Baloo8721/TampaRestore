-- TampaRestore - Supabase Database Schema
-- Run this in Supabase Dashboard → SQL Editor

-- ============================================
-- LEADS TABLE - Core lead tracking
-- ============================================

CREATE TABLE IF NOT EXISTS leads (
  -- Core IDs
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contact Info
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,

  -- Location Data (including geolocation)
  city TEXT NOT NULL,
  state TEXT DEFAULT 'FL',
  zip_code TEXT,
  lat FLOAT,
  lng FLOAT,
  full_address TEXT,

  -- Lead Details
  damage_type TEXT,
  description TEXT,

  -- Status Tracking
  status TEXT DEFAULT 'new',
  -- new = just submitted
  -- sent = sent to contractor
  -- contacted = contractor confirmed contact
  -- scheduled = job scheduled
  -- closed = job completed (won/lost)
  -- paid = you got paid
  -- junk = spam/not real

  -- Contractor Routing
  sent_to_contractor_at TIMESTAMPTZ,
  contractor_contacted_at TIMESTAMPTZ,
  assigned_contractor_email TEXT,
  contractor_response_minutes INTEGER,

  -- Revenue Tracking
  revenue_amount DECIMAL(10,2),
  revenue_type TEXT, -- 'per-lead' or 'monthly'
  paid_at TIMESTAMPTZ,

  -- Source Tracking
  source TEXT DEFAULT 'website', -- 'website', 'phone', 'referral'
  referral_code TEXT,
  referred_by_lead_id UUID REFERENCES leads(id),

  -- Additional
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES - For faster queries
-- ============================================

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);

-- ============================================
-- REALTIME - Enable live updates
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE leads;

-- ============================================
-- SECURITY POLICIES
-- ============================================

-- Allow anyone to read (for admin dashboard)
CREATE POLICY "Public can read leads" ON leads FOR SELECT USING (true);

-- Allow anyone to insert (for form submission)
CREATE POLICY "Public can insert leads" ON leads FOR INSERT WITH CHECK (true);

-- Allow updates (for admin/contractor actions)
CREATE POLICY "Public can update leads" ON leads FOR UPDATE USING (true);

-- ============================================
-- CONTRACTORS TABLE (future use)
-- ============================================

CREATE TABLE IF NOT EXISTS contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,

  service_areas TEXT[], -- ['Tampa', 'Pasco County', etc]
  damage_types TEXT[], -- ['Flooding', 'Burst Pipe', etc]

  price_per_lead DECIMAL(10,2),
  monthly_fee DECIMAL(10,2),

  active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE contractors;

-- Policies
CREATE POLICY "Public can read contractors" ON contractors FOR SELECT USING (true);
CREATE POLICY "Public can insert contractors" ON contractors FOR INSERT WITH CHECK (true);

-- ============================================
-- REFERRALS TABLE (future use)
-- ============================================

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  referrer_name TEXT,
  referrer_type TEXT, -- 'contractor', 'real-estate', 'insurance', 'plumber'

  referral_code TEXT UNIQUE NOT NULL,
  discount_percentage DECIMAL(5,2),

  leads_count INTEGER DEFAULT 0,
  total_revenue DECIMAL(10,2),

  active BOOLEAN DEFAULT true
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE referrals;

-- Policies
CREATE POLICY "Public can read referrals" ON referrals FOR SELECT USING (true);
CREATE POLICY "Public can insert referrals" ON referrals FOR INSERT WITH CHECK (true);

-- ============================================
-- STATUS HISTORY TABLE (audit trail)
-- ============================================

CREATE TABLE IF NOT EXISTS lead_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  notes TEXT,
  changed_by TEXT, -- 'system', 'admin', 'contractor'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE lead_status_history;

-- ============================================
-- DONE!
-- ============================================

-- Your database is ready! Now update your code to use it.