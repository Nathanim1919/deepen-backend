import { URL } from 'url';

interface UrlNormalizationOptions {
  forceHttps?: boolean;
  removeTrackingParams?: boolean;
  sortQueryParams?: boolean;
  stripTrailingSlash?: boolean;
}

interface ParsedHostname {
  subDomains: string[];
  domain: string | null;
  topLevelDomains: string[];
}

const DEFAULT_TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'fbclid',
  'gclid',
  'utm_term',
  'utm_content',
  'ref'
];

export const normalizeUrl = async (
  inputUrl: string,
  options: UrlNormalizationOptions = {
    forceHttps: true,
    removeTrackingParams: true,
    sortQueryParams: true,
    stripTrailingSlash: true
  }
): Promise<string> => {
  if (!inputUrl?.trim()) return '';

  try {
    // Ensure URL has protocol for proper parsing
    const urlToParse = inputUrl.includes('://') ? inputUrl : `https://${inputUrl}`;
    const url = new URL(urlToParse);

    // Protocol normalization
    if (options.forceHttps && await shouldUpgradeToHttps(url)) {
      url.protocol = 'https:';
    }

    // Hostname normalization
    url.hostname = normalizeHostname(url.hostname);

    // Query string processing
    if (url.search) {
      const searchParams = new URLSearchParams(url.search);
      
      if (options.removeTrackingParams) {
        DEFAULT_TRACKING_PARAMS.forEach(param => searchParams.delete(param));
      }

      if (options.sortQueryParams) {
        const sortedParams = Array.from(searchParams.entries())
          .sort(([a], [b]) => a.localeCompare(b));
        url.search = new URLSearchParams(sortedParams).toString();
      } else {
        url.search = searchParams.toString();
      }
    }

    // Path normalization
    if (options.stripTrailingSlash) {
      url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    }

    // Clean empty search string
    if (!url.search) {
      url.search = '';
    }

    return url.toString();
  } catch (err) {
    console.warn(`URL normalization failed for: ${inputUrl}`, err);
    return inputUrl;
  }
};

const shouldUpgradeToHttps = async (url: URL): Promise<boolean> => {
  // Skip for localhost and non-HTTP protocols
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  
  const localHosts = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
  if (localHosts.has(url.hostname)) return false;

  // Additional checks could be added here for known HTTP-only hosts
  return true;
};

const normalizeHostname = (hostname: string): string => {
  try {
    const parsed = parseHostname(hostname);
    
    if (!isPublicSuffixDomain(parsed)) {
      return hostname;
    }

    // Remove common subdomains like www, m, mobile
    const meaningfulSubdomains = parsed.subDomains.filter(
      sub => !['www', 'm', 'mobile', 'amp'].includes(sub)
    );

    return [
      ...meaningfulSubdomains,
      parsed.domain,
      ...parsed.topLevelDomains
    ].filter(Boolean).join('.');
  } catch {
    return hostname;
  }
};

export const getRootDomain = (url: string): string | null => {
  try {
    const parsed = parseHostname(new URL(url).hostname);
    if (!isPublicSuffixDomain(parsed)) return null;
    
    return [parsed.domain, ...parsed.topLevelDomains].join('.');
  } catch {
    return null;
  }
};

// Helper functions would need to be implemented or imported
declare function parseHostname(hostname: string): ParsedHostname;
declare function isPublicSuffixDomain(parsed: ParsedHostname): boolean;