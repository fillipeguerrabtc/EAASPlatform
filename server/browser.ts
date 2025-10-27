/**
 * SECURE BROWSER AUTOMATION
 * 
 * Puppeteer wrapper with security hardening based on external review:
 * - Request queue (max 2 concurrent)
 * - Media blocking (images, fonts, stylesheets) for performance
 * - URL sanitization and validation
 * - Timeout enforcement
 * - Resource cleanup
 * - User-Agent spoofing
 * 
 * Usage:
 * const result = await safeBrowserRequest(async (page) => {
 *   await page.goto('https://example.com');
 *   return await page.title();
 * });
 */

import puppeteer, { Browser, Page } from "puppeteer";
import { RequestQueue } from "./queue";
import dns from "dns";
import { promisify } from "util";

// Use dns.lookup for fresh lookups (bypasses cache)
const dnsLookup = promisify(dns.lookup);

// Global browser instance (reused for efficiency)
let browserInstance: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;

// Request queue (max 2 concurrent Puppeteer operations)
const browserQueue = new RequestQueue({
  maxConcurrent: 2,
  maxQueueSize: 10,
  defaultTimeout: 30000, // 30 seconds
});

/**
 * Launch browser with secure configuration
 */
async function launchBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  // Prevent duplicate launches
  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }

  browserLaunchPromise = puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--window-size=1920x1080",
      // REMOVED --disable-web-security for security hardening
    ],
    defaultViewport: {
      width: 1920,
      height: 1080,
    },
  });

  try {
    browserInstance = await browserLaunchPromise;
    
    // Handle browser disconnect
    browserInstance.on("disconnected", () => {
      browserInstance = null;
      browserLaunchPromise = null;
      console.warn("Browser disconnected, will relaunch on next request");
    });

    console.log("✓ Puppeteer browser launched");
    return browserInstance;
  } catch (error) {
    browserLaunchPromise = null;
    throw error;
  }
}

/**
 * Close browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    browserLaunchPromise = null;
  }
}

/**
 * Check if IP is in CIDR range
 */
function isIpInRange(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  
  const ipNum = ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  const rangeNum = range.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  
  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Check if IP (v4 or v6) is private/reserved
 */
function isPrivateIp(ip: string): boolean {
  // Localhost variants
  const localhostVariants = [
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "::ffff:127.0.0.1",
  ];
  
  if (localhostVariants.includes(ip)) {
    return true;
  }

  // Private IPv4 ranges (RFC 1918 + others)
  const privateIpv4Ranges = [
    "10.0.0.0/8",        // 10.0.0.0 - 10.255.255.255
    "172.16.0.0/12",     // 172.16.0.0 - 172.31.255.255
    "192.168.0.0/16",    // 192.168.0.0 - 192.168.255.255
    "169.254.0.0/16",    // Link-local (APIPA)
    "100.64.0.0/10",     // Carrier-grade NAT
  ];
  
  // Check IPv4
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    for (const range of privateIpv4Ranges) {
      if (isIpInRange(ip, range)) {
        return true;
      }
    }
  }

  // Private IPv6 ranges
  const privateIpv6Prefixes = [
    "fe80:", // Link-local
    "fc00:", // Unique local
    "fd00:", // Unique local
    "ff00:", // Multicast
  ];
  
  if (ip.includes(":")) {
    const lowerIp = ip.toLowerCase();
    for (const prefix of privateIpv6Prefixes) {
      if (lowerIp.startsWith(prefix)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Validate and sanitize URL with DNS resolution for SSRF prevention
 * 
 * CRITICAL: Resolves hostname to IPs and blocks private ranges to prevent:
 * - DNS rebinding attacks
 * - SSRF via public domain pointing to private IP
 * 
 * EXPORTED: For use in media downloads and other URL fetching
 */
export async function validateUrl(url: string): Promise<string> {
  // Remove whitespace
  const trimmed = url.trim();

  // Check for valid URL format
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  // Only allow http/https
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`Invalid protocol: ${parsed.protocol}. Only http/https allowed.`);
  }

  const hostname = parsed.hostname.toLowerCase();
  
  // Block localhost by name
  if (hostname === "localhost") {
    throw new Error(`Access to localhost is blocked: ${hostname}`);
  }

  // Block suspicious patterns
  if (hostname.includes("@") || hostname.includes("%")) {
    throw new Error(`Suspicious characters in hostname: ${hostname}`);
  }

  // ========================================
  // DNS RESOLUTION (CRITICAL FOR SSRF)
  // ========================================
  // Resolve hostname to IPs with FRESH lookup (bypass cache)
  // This prevents:
  // - Attacker-controlled domains pointing to private IPs
  // - DNS rebinding attacks (cache poisoning)
  
  try {
    // Use dns.lookup with { all: true, verbatim: true } to:
    // 1. Bypass Node's DNS cache (fresh lookup every time)
    // 2. Get ALL resolved IPs (not just the first one)
    // 3. Preserve order (verbatim: true)
    const addresses = await dnsLookup(hostname, { all: true, verbatim: true }) as Array<{ address: string; family: number }>;

    if (!addresses || addresses.length === 0) {
      // No DNS records - might be direct IP
      if (isPrivateIp(hostname)) {
        throw new Error(`Access to private IP is blocked: ${hostname}`);
      }
    } else {
      // Check ALL resolved IPs (critical for multi-IP hosts)
      for (const { address } of addresses) {
        if (isPrivateIp(address)) {
          throw new Error(`DNS resolves to private IP: ${hostname} → ${address}`);
        }
      }
    }
  } catch (error: any) {
    // DNS lookup failed
    if (error.code === "ENOTFOUND") {
      throw new Error(`Domain not found: ${hostname}`);
    }
    
    // Re-throw our own validation errors
    if (error.message.includes("blocked") || error.message.includes("private")) {
      throw error;
    }
    
    // Other DNS errors - be cautious and block
    throw new Error(`DNS resolution failed for ${hostname}: ${error.message}`);
  }

  return parsed.href;
}

/**
 * Block unnecessary resources AND validate URLs to prevent SSRF via redirects
 * 
 * CRITICAL: Re-validates EVERY request (including redirects) to prevent:
 * - HTTP 30x redirects to private IPs (e.g., 169.254.169.254 AWS metadata)
 * - JavaScript-triggered navigation to private endpoints
 * - Subresource fetches to internal services
 */
async function setupResourceBlocking(page: Page): Promise<void> {
  await page.setRequestInterception(true);

  page.on("request", (request) => {
    const url = request.url();
    const resourceType = request.resourceType();
    
    try {
      // Block images, fonts, stylesheets, media for performance
      if (["image", "stylesheet", "font", "media"].includes(resourceType)) {
        return request.abort();
      }

      // ========================================
      // SSRF PROTECTION: Validate ALL requests
      // ========================================
      // Re-validate URL for EVERY request (including redirects)
      // CRITICAL: Use .then()/.catch() to ensure continue/abort is called
      // synchronously (no async/await gaps that cause Protocol errors)
      
      validateUrl(url)
        .then(() => {
          // URL is safe - allow request
          request.continue();
        })
        .catch((error: any) => {
          // URL validation failed - block request
          console.warn(`[Browser Security] Blocked request to: ${url} (${error.message})`);
          request.abort("blockedbyclient");
        });
    } catch (error: any) {
      // Failsafe: abort on synchronous errors
      console.error(`[Browser Security] Synchronous error handling request: ${error.message}`);
      request.abort("failed");
    }
  });
}

/**
 * Execute browser task with queue and security
 */
export async function safeBrowserRequest<T>(
  task: (page: Page) => Promise<T>,
  options?: {
    url?: string;
    timeout?: number;
    blockMedia?: boolean;
  }
): Promise<T> {
  const timeout = options?.timeout || 30000;
  const blockMedia = options?.blockMedia !== false; // Default true

  // Validate URL if provided (DNS resolution happens here)
  const validatedUrl = options?.url ? await validateUrl(options.url) : undefined;

  return browserQueue.enqueue(async () => {
    const browser = await launchBrowser();
    const page = await browser.newPage();

    try {
      // Set user agent
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );

      // Block media if enabled
      if (blockMedia) {
        await setupResourceBlocking(page);
      }

      // Set timeout
      page.setDefaultTimeout(timeout);
      page.setDefaultNavigationTimeout(timeout);

      // Navigate if URL provided
      if (validatedUrl) {
        await page.goto(validatedUrl, {
          waitUntil: "networkidle2",
          timeout,
        });
      }

      // Execute user task
      const result = await task(page);

      return result;
    } finally {
      // Always cleanup
      await page.close();
    }
  }, { timeout });
}

/**
 * Get browser queue status
 */
export function getBrowserQueueStatus() {
  return {
    ...browserQueue.getStatus(),
    browserConnected: browserInstance?.isConnected() || false,
  };
}

/**
 * Clear browser queue
 */
export function clearBrowserQueue() {
  return browserQueue.clear();
}

/**
 * Graceful shutdown
 */
export async function shutdownBrowser() {
  clearBrowserQueue();
  await closeBrowser();
  console.log("✓ Browser shutdown complete");
}
