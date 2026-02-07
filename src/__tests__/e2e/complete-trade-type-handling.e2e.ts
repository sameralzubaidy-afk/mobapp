import { describe, it, expect, beforeAll } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getJwtRole(maybeJwt: string): string {
  if (!maybeJwt || !maybeJwt.includes('.')) return 'unknown';
  try {
    const [, payload] = maybeJwt.split('.');
    const json = Buffer.from(payload, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    return typeof parsed?.role === 'string' ? parsed.role : 'unknown';
  } catch {
    return 'unknown';
  }
}

const serviceKeyRole = getJwtRole(SUPABASE_SERVICE_KEY);
const shouldRunE2E =
  process.env.RUN_SUPABASE_E2E === 'true' &&
  Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY) &&
  (serviceKeyRole === 'unknown' || serviceKeyRole === 'service_role');

const d = shouldRunE2E ? describe : describe.skip;

d('COMPLETE-TRADE: Type handling checks', () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  });

  it('should extract integers from integer literal and JSONB inputs', async () => {
    const { data, error } = await supabase.rpc('test_complete_trade_type_handling');
    expect(error).toBeNull();
    expect(data).toBeDefined();

    const rows = Array.isArray(data) ? data as any[] : [data];

    const intLiteral = rows.find(r => r.test_case === 'int_literal');
    const jsonbNumber = rows.find(r => r.test_case === 'jsonb_number');
    const jsonbString = rows.find(r => r.test_case === 'jsonb_string');

    expect(intLiteral).toBeDefined();
    expect(jsonbNumber).toBeDefined();
    expect(jsonbString).toBeDefined();

    expect(intLiteral.extracted).toBe(5);
    expect(jsonbNumber.extracted).toBe(5);
    expect(jsonbString.extracted).toBe(5);
  });
});
