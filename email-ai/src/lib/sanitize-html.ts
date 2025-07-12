import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS and CSS leakage into the parent page
 * 
 * @param html - Raw HTML content from emails
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') {
    // Server-side fallback - basic tag stripping
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<link[^>]*>/gi, '')
      .replace(/<meta[^>]*>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '');
  }
  
  // Configure DOMPurify for safe email content - less aggressive
  const purifyConfig = {
    ALLOWED_TAGS: [
      'a', 'b', 'blockquote', 'br', 'caption', 'code', 'div', 
      'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'li',
      'ol', 'p', 'pre', 'span', 'strong', 'table', 'tbody', 'td', 
      'th', 'thead', 'tr', 'ul', 'font', 'center', 'u', 's', 'sub', 'sup',
      'section', 'article', 'aside', 'details', 'figure', 'figcaption',
      'main', 'nav', 'header', 'footer', 'mark', 'small', 'big',
      'cite', 'q', 'samp', 'var', 'time', 'data', 'abbr', 'address',
      'bdi', 'bdo', 'del', 'ins', 'kbd', 'meter', 'progress', 'ruby',
      'rt', 'rp', 'wbr', 'dl', 'dt', 'dd'
    ],
    ALLOWED_ATTR: [
      'alt', 'src', 'width', 'height', 'href', 'target', 'title', 'style',
      'class', 'id', 'colspan', 'rowspan', 'scope', 'align', 'valign',
      'bgcolor', 'color', 'size', 'face', 'border', 'cellpadding', 
      'cellspacing', 'data-*', 'role', 'aria-*', 'dir', 'lang',
      'start', 'type', 'value', 'reversed', 'cite', 'datetime',
      'abbr', 'span', 'headers', 'axis', 'summary', 'open'
    ],
    ALLOW_DATA_ATTR: true,
    ALLOW_ARIA_ATTR: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM_IMPORT: false,
    SANITIZE_DOM: true,
    SANITIZE_NAMED_PROPS: true,
    KEEP_CONTENT: true,
    IN_PLACE: false,
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea', 'iframe', 'frame', 'frameset', 'link', 'meta'],
    FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'] // Only remove dangerous event handlers
  };

  // First pass: sanitize with DOMPurify
  let sanitized = DOMPurify.sanitize(html, purifyConfig);
  
  // Second pass: manually remove only the most dangerous content, preserve styling
  sanitized = sanitized
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
    .replace(/javascript:/gi, ''); // Remove javascript: URLs

  return sanitized;
}

/**
 * Detects if the HTML content has complex styling that should be preserved as-is
 * 
 * @param html - Email HTML content
 * @returns true if the email has complex styling that should be rendered as-is
 */
export function hasComplexStyling(html: string): boolean {
  // Check for specific email providers that should preserve styling
  const hasLinkedInStyling = /linkedin\.com/i.test(html) || /li\.linkedin\.com/i.test(html);
  const hasGoogleStyling = /google\.com/i.test(html) && (/gmail/i.test(html) || /workspace/i.test(html));
  const hasFacebookStyling = /facebook\.com/i.test(html) || /meta\.com/i.test(html);
  const hasTwitterStyling = /twitter\.com/i.test(html) || /x\.com/i.test(html);
  const hasSlackStyling = /slack\.com/i.test(html);
  const hasNotionStyling = /notion\.so/i.test(html);
  const hasZoomStyling = /zoom\.us/i.test(html);
  
  // Check for CSS rules
  const hasStyleTags = /<style[\s\S]*?<\/style>/i.test(html);
  
  // Check for complex table structures with styling
  const hasStyledTables = /<table[^>]*style/i.test(html) || /<td[^>]*(?:bgcolor|style)/i.test(html);
  
  // Check for font tags with colors
  const hasFontColors = /<font[^>]*color/i.test(html);
  
  // Check for divs with background colors
  const hasBackgroundColors = /(?:background-color|bgcolor)\s*[:=]/i.test(html);
  
  // Check for images with specific styling
  const hasStyledImages = /<img[^>]*style/i.test(html);
  
  // Check for complex CSS classes that suggest branded emails
  const hasBrandedClasses = /class\s*=\s*["'][^"']*(?:header|footer|brand|logo|newsletter|campaign|template|email-)/i.test(html);
  
  // Check for multiple divs with styling (suggests complex layout)
  const styledDivs = (html.match(/<div[^>]*style/gi) || []).length;
  const hasComplexLayout = styledDivs >= 3;
  
  return hasLinkedInStyling || hasGoogleStyling || hasFacebookStyling || hasTwitterStyling || 
         hasSlackStyling || hasNotionStyling || hasZoomStyling || hasStyleTags || 
         hasStyledTables || hasFontColors || hasBackgroundColors || hasStyledImages || 
         hasBrandedClasses || hasComplexLayout;
}

/**
 * Processes email content for display with proper CSS isolation
 * 
 * @param emailBody - Raw email body HTML
 * @returns Processed HTML with appropriate styling and isolation
 */
export function processEmailContent(emailBody: string): string {
  // Try to detect if the email is plain text
  const isPlainText = !emailBody.includes('<') || !emailBody.includes('>');
  
  // Format plain text emails with dark theme support
  if (isPlainText) {
    const formattedContent = emailBody
      .split('\n')
      .map(line => {
        const escaped = escapeHtml(line);
        const withLinks = linkify(escaped);
        return line.trim() ? `<p class="text-foreground">${withLinks}</p>` : '<br>';
      })
      .join('');

    return `<div class="email-content-safe-display bg-background">${formattedContent}</div>`;
  }

  // For HTML emails, use the raw content container to preserve original styling
  const sanitizedHtml = sanitizeHtml(emailBody);
  return `<div class="email-content-raw">${sanitizedHtml}</div>`;
}

/**
 * Processes email content with minimal sanitization for display
 * 
 * @param emailBody - Raw email body HTML
 * @returns Processed HTML with CSS isolation container
 */
export function processRawEmailContent(emailBody: string): string {
  // Apply only basic security sanitization
  const basicSanitized = emailBody
    .replace(/<script[\s\S]*?<\/script>/gi, '') // Remove scripts
    .replace(/<link[^>]*>/gi, '') // Remove link tags
    .replace(/<meta[^>]*>/gi, '') // Remove meta tags
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
    .replace(/javascript:/gi, ''); // Remove javascript: URLs
  
  // Return with simple container
  return `<div class="email-content-safe">${basicSanitized}</div>`;
}

/**
 * Escape HTML entities to prevent XSS
 */
function escapeHtml(text: string): string {
  if (typeof window === 'undefined') {
    return text.replace(/[&<>"']/g, function(match) {
      const htmlEscapes: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return htmlEscapes[match];
    });
  }
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
} 

// Convert bare URLs in plain text into clickable links
function linkify(text: string): string {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => {
    const safeUrl = escapeHtml(url);
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a>`;
  });
} 