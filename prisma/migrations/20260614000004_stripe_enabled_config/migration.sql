INSERT INTO "SystemConfig" (key, value, label, description, "group", type, "createdAt")
VALUES (
  'platform.stripe_enabled',
  'false',
  'Stripe payments enabled',
  'Enable Stripe payment options in fund collection and settlements',
  'platform',
  'boolean',
  NOW()
) ON CONFLICT (key) DO NOTHING;
