import { transliterate as tr } from 'transliteration';

/**
 * Generates URL-safe slugs with multiple fallbacks
 */
export const generateSlug = (text: string, maxLength = 60): string => {
  if (!text) return 'untitled';

  // Step 1: Transliterate non-ASCII characters
  let slug = tr(text, {
    replace: [
      ['≈', '~'],
      ['≠', '!=']
    ],
    ignore: ['$', '%', '&', '+', ',', '/', ':', ';', '=', '?', '@', '#']
  });

  // Step 2: Replace special characters
  slug = slug
    .toLowerCase()
    .replace(/\s+/g, '-')       // Spaces to hyphens
    .replace(/[^\w\-~]+/g, '')  // Remove non-word chars
    .replace(/\-\-+/g, '-')     // Replace multiple hyphens
    .replace(/^-+/, '')         // Trim start
    .replace(/-+$/, '');        // Trim end

  // Step 3: Ensure minimum length
  if (!slug) {
    slug = 'untitled';
  }

  // Step 4: Enforce max length
  if (slug.length > maxLength) {
    slug = slug.substring(0, maxLength).replace(/-+$/, '');
  }

  return slug;
};

/**
 * Generates a unique slug with incrementing suffix
 */
export const generateUniqueSlug = async (
  text: string,
  model: any,
  field = 'slug',
  maxAttempts = 5
): Promise<string> => {
  let baseSlug = generateSlug(text);
  let slug = baseSlug;
  let attempt = 1;

  while (attempt <= maxAttempts) {
    const exists = await model.exists({ [field]: slug });
    if (!exists) return slug;

    slug = `${baseSlug}-${attempt}`;
    attempt++;
  }

  // Fallback to timestamp if all attempts fail
  return `${baseSlug}-${Date.now().toString(36)}`;
};