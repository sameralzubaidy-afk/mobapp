#!/bin/bash
# Phase E: Check for raw element(by.id()).tap() calls without waitFor guards
# Used as a pre-commit hook or CI check to prevent regression
# Returns non-zero exit code if violations are found

echo "🔍 Checking for raw element(by.id()).tap() calls without waitFor guards..."
echo ""

VIOLATIONS=0

while IFS= read -r line; do
  # Extract file and line
  FILE=$(echo "$line" | cut -d: -f1)
  LINE=$(echo "$line" | cut -d: -f2)
  TEXT=$(echo "$line" | cut -d: -f3-)
  
  # Skip if commented out
  if echo "$TEXT" | grep -q "^\s*//"; then
    continue
  fi
  
  # Check if there's a waitFor before this line (within 5 lines)
  HAS_WAITFOR=false
  for ((i=LINE-5; i<LINE; i++)); do
    if sed -n "${i}p" "$FILE" 2>/dev/null | grep -q "waitFor"; then
      HAS_WAITFOR=true
      break
    fi
  done
  
  if [ "$HAS_WAITFOR" = false ]; then
    echo "⚠️  $FILE:$LINE — raw tap without waitFor: $TEXT"
    VIOLATIONS=$((VIOLATIONS+1))
  fi
done < <(grep -rn "by\.id.*\.tap()" /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/detox/tests/*.e2e.ts 2>/dev/null)

echo ""
if [ $VIOLATIONS -eq 0 ]; then
  echo "✅ No violations found."
  exit 0
else
  echo "❌ $VIOLATIONS violation(s) found."
  exit 1
fi
