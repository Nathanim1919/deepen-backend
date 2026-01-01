import { createHash } from 'crypto';

/**
 * Generates consistent hash fingerprints for content deduplication
 */
export const hashContent = (content: string, algorithm = 'sha256'): string => {
  if (!content) return '';

  // Normalize content before hashing
  const normalized = content
    .replace(/\s+/g, ' ')      // Collapse whitespace
    .normalize('NFKC')         // Unicode normalization
    .trim();

  return createHash(algorithm)
    .update(normalized)
    .digest('hex');
};

/**
 * Short fingerprint for quick comparisons
 */
export const shortFingerprint = (content: string, length = 16): string => {
  return hashContent(content).substring(0, length);
};

/**
 * Compare two pieces of content for similarity
 */
export const compareContent = (a: string, b: string): number => {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const hashA = hashContent(a);
  const hashB = hashContent(b);

  // Simple equality check - could be enhanced with simhash
  return hashA === hashB ? 1 : 0;
};