#!/bin/bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
echo "Running supabase db reset..."
supabase db reset
echo "Migration completed. Checking for errors..."