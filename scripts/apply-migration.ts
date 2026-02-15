import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read .env file manually
const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.+)$/);
  if (match) {
    envVars[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260211000000_create_release_cover_art.sql'
  );

  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log('Applying migration: create_release_cover_art.sql');
  console.log('SQL:', sql);

  // Note: We need service role key to execute raw SQL
  // For now, let's just check if the table exists
  const { data, error } = await supabase
    .from('release_cover_art')
    .select('release_id')
    .limit(1);

  if (error) {
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.log('\n⚠️  Table does not exist. Please run this SQL in Supabase SQL Editor:');
      console.log('\n' + sql);
      console.log('\nYou can access it at:', `${supabaseUrl.replace('.supabase.co', '')}/project/default/sql`);
    } else {
      console.error('Error checking table:', error);
    }
  } else {
    console.log('✅ Table already exists!');
  }
}

applyMigration();
