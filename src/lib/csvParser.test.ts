import { describe, it, expect } from 'vitest';
import { parseDiscogsCSV } from './csvParser';

describe('parseDiscogsCSV', () => {
  it('should parse a basic CSV with headers', () => {
    const csvContent = `Catalog Number,Artist,Title,Label,Format,Rating,Released,release_id,CollectionFolder,Date Added,Collection Media Condition,Collection Sleeve Condition,Collection Notes
XL-001,"The Prodigy","Music For The Jilted Generation",XL Recordings,2 × Vinyl,5.0,1994,1234567,Uncategorized,2023-01-15,Mint (M),Near Mint (NM),"Great album"`;

    const tracks = parseDiscogsCSV(csvContent, 'collection');

    expect(tracks).toHaveLength(1);
    expect(tracks[0]).toMatchObject({
      artist: 'The Prodigy',
      title: 'Music For The Jilted Generation',
      source: 'collection',
      discogsReleaseId: 1234567,
    });
    expect(tracks[0].id).toBe('csv-collection-1234567');
  });

  it('should handle missing release_id by using row index', () => {
    const csvContent = `Artist,Title,Label,Released
The Beatles,Abbey Road,Apple Records,1969`;

    const tracks = parseDiscogsCSV(csvContent, 'wantlist');

    expect(tracks).toHaveLength(1);
    expect(tracks[0].id).toBe('csv-wantlist-1'); // Row index starts at 1 (after header)
    expect(tracks[0].artist).toBe('The Beatles');
    expect(tracks[0].title).toBe('Abbey Road');
  });

  it('should handle quoted fields with commas', () => {
    const csvContent = `Artist,Title,Label
"Various Artists","Compilation, Vol. 1",Label Records`;

    const tracks = parseDiscogsCSV(csvContent, 'collection');

    expect(tracks).toHaveLength(1);
    expect(tracks[0].artist).toBe('Various Artists');
    expect(tracks[0].title).toBe('Compilation, Vol. 1');
  });

  it('should throw error on empty CSV', () => {
    expect(() => parseDiscogsCSV('', 'collection')).toThrow('CSV file is empty');
  });

  it('should throw error on CSV with only headers', () => {
    const csvContent = `Artist,Title,Label,Released`;
    expect(() => parseDiscogsCSV(csvContent, 'collection')).toThrow('No valid tracks found in CSV file');
  });

  it('should parse multiple rows', () => {
    const csvContent = `Artist,Title,Label,Released,release_id
Pink Floyd,The Wall,Columbia,1979,123456
Led Zeppelin,IV,Atlantic,1971,654321`;

    const tracks = parseDiscogsCSV(csvContent, 'collection');

    expect(tracks).toHaveLength(2);
    expect(tracks[0].artist).toBe('Pink Floyd');
    expect(tracks[1].artist).toBe('Led Zeppelin');
    expect(tracks[0].discogsReleaseId).toBe(123456);
    expect(tracks[1].discogsReleaseId).toBe(654321);
  });
});
