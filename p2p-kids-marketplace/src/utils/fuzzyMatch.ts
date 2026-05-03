/**
 * File: p2p-kids-marketplace/src/utils/fuzzyMatch.ts
 * MODULE-05-DISCOVERY-V3: Fuzzy Matching Utilities
 * Task: DISCOVERY-V3-004 (dependency for DISCOVERY-V3-003)
 *
 * Provides Levenshtein distance calculation and typo suggestion
 */

/**
 * Calculate Levenshtein distance between two strings
 * Uses dynamic programming for O(n*m) time complexity
 *
 * @param a - First string
 * @param b - Second string
 * @returns Minimum number of single-character edits (insertions, deletions, substitutions)
 *
 * @example
 * levenshteinDistance('kitten', 'sitting') // 3
 * levenshteinDistance('bicycle', 'bycicle') // 1
 * levenshteinDistance('', 'abc') // 3
 */
export function levenshteinDistance(a: string, b: string): number {
  // Handle empty strings
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Create DP matrix
  const matrix: number[][] = [];

  // Initialize first column and row
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix using DP
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Find the closest matching string from a list of candidates
 * Uses Levenshtein distance with a maximum threshold
 *
 * @param query - The search query (potentially misspelled)
 * @param candidates - Array of valid strings to match against
 * @param threshold - Maximum Levenshtein distance to consider (default 3)
 * @returns The closest matching string, or null if no match within threshold
 *
 * @example
 * findClosestMatch('bycicle', ['bicycle', 'tricycle', 'scooter'], 3) // 'bicycle'
 * findClosestMatch('xyz', ['bicycle', 'tricycle'], 2) // null
 * findClosestMatch('LEGO', ['lego', 'LEGO', 'Lego'], 0) // 'LEGO' (exact match)
 */
export function findClosestMatch(
  query: string,
  candidates: string[],
  threshold: number = 3
): string | null {
  if (!query || query.trim().length === 0) {
    return null;
  }

  if (!candidates || candidates.length === 0) {
    return null;
  }

  // Normalize query for comparison (case-insensitive)
  const normalizedQuery = query.toLowerCase().trim();

  let bestMatch: string | null = null;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    if (!candidate) continue;

    const normalizedCandidate = candidate.toLowerCase().trim();
    const distance = levenshteinDistance(normalizedQuery, normalizedCandidate);

    // Update best match if this is closer
    if (distance < bestDistance && distance <= threshold) {
      bestDistance = distance;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}
