import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS and other security issues
 * 
 * @param html - Raw HTML content from emails
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') {
    return html;
  }
  
  // Configure DOMPurify for safe email content
  const purifyConfig = {
    ALLOWED_TAGS: [
      'a', 'b', 'blockquote', 'br', 'caption', 'code', 'div', 
      'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'li',
      'ol', 'p', 'pre', 'span', 'strong', 'table', 'tbody', 'td', 
      'th', 'thead', 'tr', 'ul', 'font', 'center', 'u', 's', 'sub', 'sup',
      'section', 'article', 'aside', 'details', 'figure', 'figcaption',
      'main', 'nav', 'header', 'footer', 'style', 'mark', 'small', 'big',
      'cite', 'q', 'samp', 'var', 'time', 'data', 'abbr', 'address',
      'bdi', 'bdo', 'del', 'ins', 'kbd', 'meter', 'progress', 'ruby',
      'rt', 'rp', 'wbr'
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
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|xxx):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea', 'iframe', 'frame', 'frameset'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
    USE_PROFILES: { html: true },
    WHOLE_DOCUMENT: false,
    FORCE_BODY: false
  };
  
  try {
  return DOMPurify.sanitize(html, purifyConfig);
  } catch (error) {
    console.error('Error sanitizing HTML:', error);
    return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, '');
  }
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
  
  // Check for inline styles with specific colors
  const hasInlineColors = /style\s*=\s*["'][^"']*(?:color|background|background-color)\s*:[^"']*["']/i.test(html);
  
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
  
  // Check for CSS grid or flexbox
  const hasModernLayout = /(?:display\s*:\s*(?:flex|grid)|flex-|grid-)/i.test(html);
  
  // Check for multiple colors in the email
  const colorMatches = html.match(/#[0-9a-f]{3,6}|rgb\s*\(|rgba\s*\(|hsl\s*\(/gi) || [];
  const hasMultipleColors = colorMatches.length >= 3;
  
  return hasLinkedInStyling || hasGoogleStyling || hasFacebookStyling || hasTwitterStyling || 
         hasSlackStyling || hasNotionStyling || hasZoomStyling ||
         hasInlineColors || hasStyleTags || hasStyledTables || hasFontColors || 
         hasBackgroundColors || hasStyledImages || hasBrandedClasses || 
         hasComplexLayout || hasModernLayout || hasMultipleColors;
}

/**
 * Processes email content for display, applying dark theme only to simple text-based emails
 * 
 * @param emailBody - Sanitized email body HTML
 * @returns Processed HTML with appropriate styling
 */
export function processEmailContent(emailBody: string): string {
  // Try to detect if the email is plain text
  const isPlainText = !emailBody.includes('<') || !emailBody.includes('>');
  
  // Format plain text emails
  if (isPlainText) {
    const formattedContent = emailBody
        .split('\n')
        .map(line => line.trim() ? `<p>${line}</p>` : '<br>')
      .join('');

    return `<div class="email-content simple-email">${formattedContent}</div>`;
          }

  // Check if email has complex styling
  const hasComplex = hasComplexStyling(emailBody);
  
  if (hasComplex) {
    // For complex styled emails, wrap with readable class that ensures text is visible
    return `<div class="email-content complex-email-beautiful">${emailBody}</div>`;
  } else {
    // For simple HTML emails, apply theme-aware styling
    return `<div class="email-content simple-email">${emailBody}</div>`;
  }
            }

/**
 * Processes email content without any sanitization - returns raw HTML exactly as received
 * 
 * @param emailBody - Raw email body HTML
 * @returns Raw HTML content with minimal wrapper for responsiveness
 */
export function processRawEmailContent(emailBody: string): string {
  // Return completely raw HTML with just a minimal container for responsiveness
  return `<div class="email-content-raw">${emailBody}</div>`;
} 