INSERT INTO "SystemConfig" (key, value, label, description, "group", type, "updatedAt")
VALUES (
  'platform.admin_email',
  'admin@whatsyourshare.app',
  'Admin email',
  'Email address that receives disbursement requests and other admin notifications',
  'platform',
  'string',
  NOW()
)
ON CONFLICT (key) DO NOTHING;
