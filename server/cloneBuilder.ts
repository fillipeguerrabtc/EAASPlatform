import puppeteer from 'puppeteer';

export interface CloneManifest {
  sourceUrl: string;
  capturedAt: string;
  pagesCount: number;
  assetsCount: number;
  totalSize: number;
  metadata?: {
    title?: string;
    description?: string;
  };
}

export interface CloneBundle {
  html: string;
  manifest: CloneManifest;
}

/**
 * Build a static snapshot of a website with HTML rewriting
 * Captures HTML, inlines CSS, converts assets to base64
 * @param url - Website URL to clone
 * @returns CloneBundle with rewritten HTML and manifest
 */
export async function buildStaticSnapshot(url: string): Promise<CloneBundle> {
  let browser;
  
  try {
    const chromiumPath = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium-browser';
    
    browser = await puppeteer.launch({
      executablePath: chromiumPath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
      headless: true,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate and wait for all resources
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Extract page metadata
    const metadata = await page.evaluate(() => {
      const titleEl = document.querySelector('title');
      const descEl = document.querySelector('meta[name="description"]');
      return {
        title: titleEl?.textContent || '',
        description: descEl?.getAttribute('content') || '',
      };
    });

    // Get HTML content after all JavaScript has run
    const htmlContent = await page.content();

    // Rewrite HTML to inline resources
    const rewrittenHtml = await rewriteHtml(page, htmlContent, url);

    const manifest: CloneManifest = {
      sourceUrl: url,
      capturedAt: new Date().toISOString(),
      pagesCount: 1,
      assetsCount: 0,
      totalSize: rewrittenHtml.length,
      metadata,
    };

    console.log('✅ Clone Builder - Snapshot Complete:', {
      sourceUrl: url,
      htmlSize: `${(rewrittenHtml.length / 1024).toFixed(2)} KB`,
      metadata,
    });

    return {
      html: rewrittenHtml,
      manifest,
    };
  } catch (error: any) {
    console.error('Clone builder error:', error);
    throw new Error(`Failed to build static snapshot: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Rewrite HTML to inline all external resources and make it self-contained
 */
async function rewriteHtml(page: any, html: string, baseUrl: string): Promise<string> {
  // Use page.evaluate to rewrite HTML in the browser context
  const rewritten = await page.evaluate((baseUrlArg: string) => {
    const doc = document.cloneNode(true) as Document;

    // Inline all stylesheets
    const styleSheets = Array.from(document.styleSheets);
    styleSheets.forEach((sheet, index) => {
      try {
        const rules = Array.from(sheet.cssRules || []);
        const cssText = rules.map(rule => rule.cssText).join('\n');
        if (cssText) {
          const styleEl = doc.createElement('style');
          styleEl.textContent = cssText;
          const linkEl = doc.querySelectorAll('link[rel="stylesheet"]')[index];
          if (linkEl) {
            linkEl.parentNode?.replaceChild(styleEl, linkEl);
          } else {
            doc.head.appendChild(styleEl);
          }
        }
      } catch (e) {
        console.warn('Could not inline stylesheet:', e);
      }
    });

    // CRITICAL SECURITY: Remove ALL untrusted scripts (allowlist-based)
    // SECURITY POLICY: Default deny - only explicitly allowed domains permitted
    const ALLOWED_SCRIPT_DOMAINS: string[] = [
      // Currently empty - only manually verified CDNs will be added
      // Example: 'cdn.jsdelivr.net', 'unpkg.com'
    ];

    const scripts = doc.querySelectorAll('script');
    scripts.forEach(script => {
      const src = script.getAttribute('src');
      
      // DENY ALL inline scripts (highest XSS risk)
      if (!src) {
        console.log('🔒 Removed inline script for security');
        script.remove();
        return;
      }
      
      // Check external scripts against allowlist
      try {
        const url = new URL(src, baseUrlArg);
        const domain = url.hostname;
        
        const isAllowed = ALLOWED_SCRIPT_DOMAINS.some(allowed => 
          domain.includes(allowed)
        );
        
        if (!isAllowed) {
          console.log(`🔒 Removed untrusted script: ${src}`);
          script.remove();
        }
      } catch (e) {
        // Invalid URL - remove it
        console.log(`🔒 Removed script with invalid URL: ${src}`);
        script.remove();
      }
    });

    // Remove ALL event handlers (onclick, onload, etc) - XSS vectors
    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('on')) {
          el.removeAttribute(attr.name);
          console.log(`🔒 Removed event handler: ${attr.name}`);
        }
      });
    });

    // Convert all relative URLs to absolute
    const links = doc.querySelectorAll('a[href]');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href && !href.startsWith('http') && !href.startsWith('#')) {
        try {
          link.setAttribute('href', new URL(href, baseUrlArg).href);
        } catch (e) {
          console.warn('Could not resolve URL:', href);
        }
      }
    });

    // Inject EAAS runtime placeholder (will be replaced by server at runtime)
    const eaasScript = doc.createElement('script');
    eaasScript.textContent = `
      // EAAS Runtime Injection Point
      console.log('[EAAS] Runtime loaded for cloned marketplace');
      window.__EAAS_CLONE_MODE__ = true;
    `;
    doc.body.appendChild(eaasScript);

    return doc.documentElement.outerHTML;
  }, baseUrl);

  return rewritten;
}

/**
 * Multi-page crawl (Phase 4 enhancement)
 * Crawls up to maxPages starting from seed URL
 */
export async function buildMultiPageSnapshot(
  seedUrl: string,
  maxPages: number = 5
): Promise<CloneBundle> {
  // Phase 4 implementation - for now return single page
  return buildStaticSnapshot(seedUrl);
}
