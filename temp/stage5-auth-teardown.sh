#!/usr/bin/env bash
# Stage 5 — Auth-Identity Teardown (staging drntwgporzabmxdqykrp)
# Deletes 12 approved pilot test accounts via the GoTrue Auth Admin API.
# Service-role key is read from .env.staging at runtime — never printed.
# Reversible? NO — auth deletion is irreversible. Run only after list approval.

set -u

ENV_FILE="/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.env.staging"
BASE="https://drntwgporzabmxdqykrp.supabase.co/auth/v1/admin/users"

SRK=$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
if [ -z "$SRK" ]; then
  echo "FATAL: could not read SUPABASE_SERVICE_ROLE_KEY from $ENV_FILE"
  exit 1
fi

# uid|email  (email for a readable log only; uid is what gets deleted)
PAIRS="
74cec653-9bef-47d9-a501-73264b5d44f6|rewardsfirsttradebobauto.demo@example.com
4ef0c936-c020-4288-86ab-e9bec5076c05|alice.stage3.0811@example.com
954c05d6-c21f-469c-a64d-60a0c9bef9a5|qa.otp.verify.1786479747@example.com
586fb634-faae-43d2-9950-8bf6d332a46d|bob.stage3.1786481365@example.com
0ad281b4-0d5b-4940-a021-d4783700301a|bob.stage3.dl.fix.1786484977@example.com
277c2df7-458f-4cb5-9410-0dc77be2f23b|stage4.s0.acc2.1786533400@example.com
2264dad0-6c81-4a2c-974e-5a27d50abf1a|stage4.s2.acc1.1786534989@example.com
557cf880-79cb-4899-adbd-7ac381ea178a|stage2.referral.invalid.demo@example.com
27a77600-4146-461d-8e10-71d0451f01e8|stage2.referral.valid.demo@example.com
98c6328d-85c8-4b0d-86dc-359b8dd35eba|stage3.underage.demo@example.com
ade0ea0a-5357-4671-9e86-d1af2ce9f03a|bob.stage3.dl.1786483702@example.com
2e9e8e42-de64-4683-8881-c6f9084f7566|bob.stage3.dl.clean.1786484166@example.com
"

echo "Starting teardown of $(echo "$PAIRS" | grep -c '|') accounts..."
echo "$PAIRS" | while IFS='|' read -r AUTH_UID EMAIL; do
  [ -z "$AUTH_UID" ] && continue
  code=$(curl -sS -o /dev/null -w "%{http_code}" -X DELETE "$BASE/$AUTH_UID" \
    -H "Authorization: Bearer $SRK" -H "apikey: $SRK")
  echo "$EMAIL ($AUTH_UID) -> HTTP $code"
done
unset SRK
echo "Done."
