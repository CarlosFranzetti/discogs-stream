import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Running migration: create_release_cover_art');

    // Check if table exists first
    const { error: checkError } = await supabase
      .from('release_cover_art')
      .select('release_id')
      .limit(1);

    if (!checkError) {
      return new Response(JSON.stringify({ message: 'Table already exists' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Run the migration SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create table for storing Discogs release cover art URLs
        CREATE TABLE IF NOT EXISTS release_cover_art (
          release_id BIGINT PRIMARY KEY,
          cover_url TEXT,
          thumb_url TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Enable RLS
        ALTER TABLE release_cover_art ENABLE ROW LEVEL SECURITY;

        -- Allow all users to read cover art (it's public data)
        CREATE POLICY "Anyone can read cover art" ON release_cover_art
          FOR SELECT
          USING (true);

        -- Allow all authenticated users to insert/update (for scraping)
        CREATE POLICY "Anyone can insert cover art" ON release_cover_art
          FOR INSERT
          WITH CHECK (true);

        CREATE POLICY "Anyone can update cover art" ON release_cover_art
          FOR UPDATE
          USING (true);

        -- Create index for faster lookups
        CREATE INDEX IF NOT EXISTS idx_release_cover_art_release_id ON release_cover_art(release_id);
      `
    });

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({
      message: 'Migration applied successfully',
      data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Migration error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
