CREATE TABLE "SystemConfig" (
    "key"         TEXT NOT NULL,
    "value"       TEXT NOT NULL,
    "label"       TEXT NOT NULL,
    "description" TEXT,
    "group"       TEXT NOT NULL,
    "type"        TEXT NOT NULL DEFAULT 'number',
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "SystemConfig" ADD CONSTRAINT "SystemConfig_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default values
INSERT INTO "SystemConfig" ("key","value","label","description","group","type","updatedAt") VALUES
  -- Platform
  ('platform.fee_rate',        '0.015',  'Platform fee rate',      'Fraction taken on fund contributions (e.g. 0.015 = 1.5%)', 'platform', 'number',  NOW()),
  ('platform.ai_model',        '"claude-haiku-4-5"', 'AI model', 'Anthropic model used for receipt scanning and insights', 'platform', 'string', NOW()),
  ('platform.ai_max_tokens',   '800',    'AI max tokens',          'Max tokens returned per AI insights call',              'platform', 'number',  NOW()),
  -- Scan top-up packs
  ('pricing.topup_small.scans',       '10',    'Small pack — scans',         'Number of bonus scans in the small top-up pack',        'pricing',  'number',  NOW()),
  ('pricing.topup_small.price_cents', '249',   'Small pack — price (cents)', 'Display price in cents; must match Stripe price object', 'pricing',  'number',  NOW()),
  ('pricing.topup_small.stripe_price_id', '""','Small pack — Stripe price ID','Stripe price ID for the small top-up pack',            'pricing',  'string',  NOW()),
  ('pricing.topup_large.scans',       '50',    'Large pack — scans',         'Number of bonus scans in the large top-up pack',        'pricing',  'number',  NOW()),
  ('pricing.topup_large.price_cents', '699',   'Large pack — price (cents)', 'Display price in cents; must match Stripe price object', 'pricing',  'number',  NOW()),
  ('pricing.topup_large.stripe_price_id', '""','Large pack — Stripe price ID','Stripe price ID for the large top-up pack',            'pricing',  'string',  NOW()),
  -- Subscription prices and Stripe price IDs
  ('pricing.plan_pro.price_cents',         '999',  'Pro plan — display price (cents)',    'Shown in upgrade prompts; billing is in Stripe',    'pricing', 'number', NOW()),
  ('pricing.plan_family.price_cents',      '1499', 'Family plan — display price (cents)', 'Shown in upgrade prompts; billing is in Stripe',    'pricing', 'number', NOW()),
  ('pricing.plan_pro.stripe_price_id',     '""',   'Pro plan — Stripe price ID',          'Stripe recurring price ID for the Pro subscription', 'pricing', 'string', NOW()),
  ('pricing.plan_family.stripe_price_id',  '""',   'Family plan — Stripe price ID',       'Stripe recurring price ID for the Family subscription','pricing','string', NOW()),
  -- FREE plan limits
  ('plans.free.max_groups',       '3',     'Free — max groups',        'Max groups a Free user can own',                        'plans',    'number',  NOW()),
  ('plans.free.max_ai_scans',     '0',     'Free — monthly AI scans',  'Monthly AI scan allowance for Free users (0 = none)',   'plans',    'number',  NOW()),
  ('plans.free.can_create_events','false', 'Free — can create events', 'Whether Free users can create events/trips',            'plans',    'boolean', NOW()),
  -- PRO plan limits
  ('plans.pro.max_groups',        '0',     'Pro — max groups',         'Max groups for Pro users (0 = unlimited)',               'plans',    'number',  NOW()),
  ('plans.pro.max_ai_scans',      '20',    'Pro — monthly AI scans',   'Monthly AI scan allowance for Pro users',               'plans',    'number',  NOW()),
  ('plans.pro.can_create_events', 'true',  'Pro — can create events',  'Whether Pro users can create events/trips',             'plans',    'boolean', NOW()),
  -- FAMILY plan limits
  ('plans.family.max_groups',        '0',  'Family — max groups',         'Max groups for Family users (0 = unlimited)',         'plans',    'number',  NOW()),
  ('plans.family.max_ai_scans',      '20', 'Family — monthly AI scans',   'Monthly AI scan allowance for Family users',         'plans',    'number',  NOW()),
  ('plans.family.can_create_events', 'true','Family — can create events',  'Whether Family users can create events/trips',      'plans',    'boolean', NOW());
