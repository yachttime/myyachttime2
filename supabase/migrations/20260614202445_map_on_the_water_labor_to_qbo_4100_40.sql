INSERT INTO quickbooks_account_mappings (
  mapping_type,
  internal_code_id,
  internal_code_type,
  qbo_account_id,
  is_default,
  notes,
  created_by,
  company_id
) VALUES (
  'labor',
  '179d8b0b-d559-4ad9-a049-0145c6bf3de2',
  'labor_code',
  '91dc86eb-8905-4e53-99e2-2e881c5cea0f',
  false,
  '',
  '610f94b4-646f-4f5b-b64a-a47723f6e85e',
  '519b4394-d35c-46d7-997c-db7e46178ef5'
)
ON CONFLICT DO NOTHING;
