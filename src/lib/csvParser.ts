import { Track } from '@/types/track';

/**
 * Parses a Discogs CSV export and converts it to Track objects.
 *
 * Discogs CSV format typically includes:
 * Catalog#, Artist, Title, Label, Format, Rating, Released, release_id, etc.
 */
export function parseDiscogsCSV(csvContent: string, source: 'collection' | 'wantlist'): Track[] {
  const lines = csvContent.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]);

  // Find column indices
  const getColumnIndex = (possibleNames: string[]): number => {
    for (const name of possibleNames) {
      const index = headers.findIndex(h =>
        h.toLowerCase().replace(/[^a-z0-9]/g, '') === name.toLowerCase().replace(/[^a-z0-9]/g, '')
      );
      if (index !== -1) return index;
    }
    return -1;
  };

  const artistIdx = getColumnIndex(['Artist', 'artist']);
  const titleIdx = getColumnIndex(['Title', 'title', 'Album']);
  const labelIdx = getColumnIndex(['Label', 'label']);
  const releasedIdx = getColumnIndex(['Released', 'released', 'Year', 'year']);
  const releaseIdIdx = getColumnIndex(['release_id', 'releaseid', 'Release ID']);
  const catalogIdx = getColumnIndex(['Catalog#', 'catalog', 'CatalogNumber']);
  const formatIdx = getColumnIndex(['Format', 'format']);

  if (artistIdx === -1 || titleIdx === -1) {
    throw new Error('CSV must contain Artist and Title columns');
  }

  const tracks: Track[] = [];

  // Parse data rows (skip header)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const values = parseCSVLine(line);

      const artist = values[artistIdx]?.trim() || 'Unknown Artist';
      const title = values[titleIdx]?.trim() || 'Unknown Title';
      const label = labelIdx !== -1 ? values[labelIdx]?.trim() || 'Unknown' : 'Unknown';
      const releasedStr = releasedIdx !== -1 ? values[releasedIdx]?.trim() || '' : '';
      const releaseId = releaseIdIdx !== -1 ? parseInt(values[releaseIdIdx]?.trim() || '0') : 0;
      const catalog = catalogIdx !== -1 ? values[catalogIdx]?.trim() || '' : '';
      const format = formatIdx !== -1 ? values[formatIdx]?.trim() || '' : '';

      // Parse year from Released field (could be "YYYY", "DD Mon YYYY", etc.)
      let year = 0;
      const yearMatch = releasedStr.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        year = parseInt(yearMatch[0]);
      }

      // Extract genre from format if possible (e.g., "Vinyl, LP, Album, Rock")
      let genre = 'Unknown';
      if (format) {
        const formatParts = format.split(',').map(p => p.trim());
        // Common genres that might appear in format
        const genreKeywords = ['Rock', 'Pop', 'Jazz', 'Electronic', 'Hip Hop', 'Classical', 'Folk', 'Metal', 'Soul', 'Funk', 'Blues', 'Country', 'Reggae'];
        for (const part of formatParts) {
          if (genreKeywords.some(g => part.toLowerCase().includes(g.toLowerCase()))) {
            genre = part;
            break;
          }
        }
      }

      // Clean up artist name (remove Discogs numbering like (2), (3))
      const cleanArtist = artist.replace(/\s*\(\d+\)$/, '');

      const track: Track = {
        id: `csv-${source}-${releaseId || i}`,
        title,
        artist: cleanArtist,
        album: title,
        year,
        genre,
        label,
        duration: 240, // Default duration
        coverUrl: '/placeholder.svg', // No cover URL from CSV
        youtubeId: '', // Will be resolved later
        discogsReleaseId: releaseId || undefined,
        source,
      };

      tracks.push(track);
    } catch (err) {
      console.warn(`Failed to parse CSV line ${i + 1}:`, err);
      // Continue parsing other lines
    }
  }

  if (tracks.length === 0) {
    throw new Error('No valid tracks found in CSV file');
  }

  return tracks;
}

/**
 * Parse a CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quotes
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current);

  return result;
}
