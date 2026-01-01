import sanitizeHtmlLib from 'sanitize-html';

/**
 * Configurable HTML sanitizer with safe defaults
 */
export const sanitizeHtml = (dirty: string, options: sanitizeHtmlLib.IOptions = {}): string => {
  const defaultOptions: sanitizeHtmlLib.IOptions = {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    allowedAttributes: {
      'a': ['href', 'title', 'rel']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      'a': sanitizeHtmlLib.simpleTransform('a', {
        rel: 'noopener noreferrer',
        target: '_blank'
      })
    },
    // Strip all other HTML
    exclusiveFilter: (frame) => !frame.text.trim()
  };

  return sanitizeHtmlLib(dirty, { ...defaultOptions, ...options });
};

/**
 * Strict text-only sanitizer 
 */
export const sanitizeText = (text: string) => {
  return sanitizeHtml(text, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard'
  }).trim();
};

/**
 * Escapes markdown special characters for safe rendering
 */
export function escapeMarkdown(text: string): string {
  return text
    .replace(/([*_`~>])/g, '\\$1') // Escape markdown special chars
    .replace(/\[(.*?)\]\((.*?)\)/g, '[$1](<$2>)'); // Escape links
}