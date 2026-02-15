#!/bin/bash

# Read environment variables
source .env

# SQL to create the table
SQL=$(cat supabase/migrations/20260211000000_create_release_cover_art.sql)

echo "Creating release_cover_art table..."
echo ""

# Use Supabase REST API to execute SQL
curl -X POST "${VITE_SUPABASE_URL}/rest/v1/rpc/exec" \
  -H "apikey: ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
  -H "Content-Type: application/json" \
  --data "{\"query\": $(echo "$SQL" | jq -Rs .)}"

echo ""
echo "Done!"
