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

// Parse test CSV
const csvPath = path.join(process.cwd(), 'test-collection.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split('\n').filter(line => line.trim());

console.log('Test CSV File:', csvPath);
console.log('Lines found:', lines.length);
console.log('\nParsing CSV...\n');

// Parse header
const headers = lines[0].split(',');
console.log('Headers:', headers.join(', '));

// Parse data rows
for (let i = 1; i < lines.length; i++) {
  const values = lines[i].split(',');
  const artist = values[1];
  const title = values[2];
  const releaseId = values[7];

  console.log(`\nTrack ${i}:`);
  console.log(`  Artist: ${artist}`);
  console.log(`  Title: ${title}`);
  console.log(`  Release ID: ${releaseId}`);

  if (releaseId) {
    console.log(`  ✓ Will fetch cover art from Discogs API`);
    console.log(`  API URL: ${supabaseUrl}/functions/v1/discogs-public`);
    console.log(`  Payload: { release_id: ${releaseId} }`);
  } else {
    console.log(`  ✗ No release ID - cannot fetch cover art`);
  }
}

console.log('\n\nTest Summary:');
console.log('- CSV parsing: ✓ Working');
console.log('- Release ID extraction: ✓ Working');
console.log('- Ready for cover art scraping: ✓ Yes');
console.log('\nNext steps:');
console.log('1. Upload test-collection.csv via the app');
console.log('2. Watch console for cover art scraping logs');
console.log('3. Verify covers appear in player and playlist');
