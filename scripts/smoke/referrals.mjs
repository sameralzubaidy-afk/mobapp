#!/usr/bin/env node

import 'dotenv/config';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

function fail(message, details) {
  console.error(`[SMOKE] FAIL: ${message}`);
  if (details) console.error(details);
  process.exit(1);
}

function pass(message) {
  console.log(`[SMOKE] PASS: ${message}`);
}

function requireEnv(name, fallbackNames = []) {
  const direct = (process.env[name] ?? '').trim();
  if (direct) return direct;
  for (const alt of fallbackNames) {
    const v = (process.env[alt] ?? '').trim();
    if (v) return v;
  }
  fail(`Missing env var: ${name}${fallbackNames.length ? ` (or ${fallbackNames.join(', ')})` : ''}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomEmail(prefix) {
  const id = crypto.randomBytes(6).toString('hex');
  return `${prefix}+${Date.now()}-${id}@example.com`;
}

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL', ['EXPO_PUBLIC_SUPABASE_URL']);
  const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY', ['EXPO_PUBLIC_SUPABASE_ANON_KEY']);

  const password = (process.env.SUPABASE_SMOKE_PASSWORD ?? 'Passw0rd!Passw0rd!').trim();

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  // 1) Sign up referrer
  const referrerEmail = randomEmail('smoke-referrer');
  const referrerMeta = {
    display_name: 'Smoke Referrer',
    phone: '+15555550101',
    dob: '1990-01-01',
  };

  const { data: refSignUp, error: refSignUpError } = await supabase.auth.signUp({
    email: referrerEmail,
    password,
    options: { data: referrerMeta },
  });

  if (refSignUpError) {
    fail('Referrer signUp failed', refSignUpError);
  }

  const referrerUserId = refSignUp?.user?.id;
  if (!referrerUserId) {
    fail('Referrer signUp returned no user id');
  }

  // Give DB triggers a moment
  await sleep(400);

  // 2) Sign in referrer (local env should allow immediate sign-in)
  const { data: refSignIn, error: refSignInError } = await supabase.auth.signInWithPassword({
    email: referrerEmail,
    password,
  });

  if (refSignInError) {
    fail('Referrer signIn failed (is email confirmation required in this environment?)', refSignInError);
  }

  if (!refSignIn?.session) {
    fail('Referrer signIn returned no session');
  }

  // 3) Fetch referrer referral code from referral_codes (preferred), fallback to profiles.referral_code
  const { data: rcRow, error: rcError } = await supabase
    .from('referral_codes')
    .select('code')
    .eq('user_id', referrerUserId)
    .maybeSingle();

  if (rcError) {
    fail('Failed to read referral_codes for referrer', rcError);
  }

  let referralCode = (rcRow?.code ?? '').trim();

  if (!referralCode) {
    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('user_id', referrerUserId)
      .maybeSingle();

    if (profileError) {
      fail('Failed to read profiles.referral_code for referrer', profileError);
    }

    referralCode = (profileRow?.referral_code ?? '').trim();
  }

  if (!referralCode || referralCode.length !== 8) {
    fail(`Referrer referral code missing/invalid. Got: "${referralCode}"`);
  }

  pass(`Referrer referral code generated: ${referralCode}`);

  // 4) Sign out referrer to avoid session confusion
  await supabase.auth.signOut();

  // 5) Sign up referee WITH referral metadata
  const refereeEmail = randomEmail('smoke-referee');
  const refereeMeta = {
    display_name: 'Smoke Referee',
    phone: '+15555550102',
    dob: '1990-01-02',
    referral_code: referralCode.toLowerCase(),
  };

  const { data: ref2SignUp, error: ref2SignUpError } = await supabase.auth.signUp({
    email: refereeEmail,
    password,
    options: { data: refereeMeta },
  });

  if (ref2SignUpError) {
    fail('Referee signUp failed', ref2SignUpError);
  }

  const refereeUserId = ref2SignUp?.user?.id;
  if (!refereeUserId) {
    fail('Referee signUp returned no user id');
  }

  await sleep(600);

  const { data: ref2SignIn, error: ref2SignInError } = await supabase.auth.signInWithPassword({
    email: refereeEmail,
    password,
  });

  if (ref2SignInError) {
    fail('Referee signIn failed', ref2SignInError);
  }

  if (!ref2SignIn?.session) {
    fail('Referee signIn returned no session');
  }

  // 6) Assert referred_by is set
  const { data: refereeProfile, error: refereeProfileError } = await supabase
    .from('profiles')
    .select('referred_by, referred_by_code')
    .eq('user_id', refereeUserId)
    .maybeSingle();

  if (refereeProfileError) {
    fail('Failed to read profiles.referred_by for referee', refereeProfileError);
  }

  const referredBy = refereeProfile?.referred_by ?? null;
  if (!referredBy) {
    fail('profiles.referred_by is NULL after signup with referral code (trigger/RPC likely not applying)');
  }

  if (referredBy !== referrerUserId) {
    fail(`profiles.referred_by mismatch. Expected ${referrerUserId}, got ${referredBy}`);
  }

  pass('profiles.referred_by populated correctly from signup referral metadata');

  // 7) Assert referred_by_code is persisted
  const referredByCode = (refereeProfile?.referred_by_code ?? '').trim().toLowerCase();
  if (!referredByCode) {
    fail('profiles.referred_by_code is NULL/empty after signup with referral code');
  }

  if (referredByCode !== referralCode.trim().toLowerCase()) {
    fail(`profiles.referred_by_code mismatch. Expected ${referralCode}, got ${referredByCode}`);
  }

  pass('profiles.referred_by_code persisted correctly');
}

main().catch((e) => fail('Unhandled exception', e));
