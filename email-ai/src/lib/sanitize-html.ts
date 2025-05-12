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
      'th', 'thead', 'tr', 'ul'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'style', 'width', 'height', 'class',
      'border', 'cellpadding', 'cellspacing', 'align', 'valign'
    ],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    ADD_ATTR: ['target'], 
    WHOLE_DOCUMENT: false,
    SANITIZE_DOM: true
  };
  
  return DOMPurify.sanitize(html, purifyConfig);
}

/**
 * Creates a complete HTML document for the iframe with the sanitized email content
 * 
 * @param emailBody - Sanitized email body HTML
 * @returns Complete HTML document for iframe
 */
export function createEmailDocument(emailBody: string): string {
  // Try to detect if the email is plain text
  const isPlainText = !emailBody.includes('<') || !emailBody.includes('>');
  
  // Format plain text emails
  const formattedContent = isPlainText 
    ? emailBody
        .split('\n')
        .map(line => `<p>${line || '&nbsp;'}</p>`)
        .join('')
    : emailBody;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          :root {
            color-scheme: light dark;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 16px;
            color: #333;
            background-color: transparent;
            line-height: 1.5;
            font-size: 16px;
          }
          
          @media (prefers-color-scheme: dark) {
            body {
              color: #e1e1e1;
            }
            
            /* Force all text elements to use proper color in dark mode */
            p, div, span, h1, h2, h3, h4, h5, h6, li, td, th, blockquote {
              color: #e1e1e1 !important;
            }
            
            /* Handle background colors */
            [style*="background-color"] {
              background-color: transparent !important;
            }
            
            /* Ensure table borders are visible */
            table, td, th {
              border-color: #555 !important;
            }
            
            a {
              color: #3b82f6 !important;
            }
          }
          
          /* Light mode specific overrides */
          @media (prefers-color-scheme: light) {
            /* Force all text elements to use proper color in light mode */
            p, div, span, h1, h2, h3, h4, h5, h6, li, td, th, blockquote {
              color: #333 !important;
            }
            
            a {
              color: #0070f3 !important;
            }
          }
          
          img {
            max-width: 100%;
            height: auto;
          }
          
          pre, code {
            white-space: pre-wrap;
            background-color: rgba(0, 0, 0, 0.05);
            border-radius: 3px;
            padding: 0.2em 0.4em;
            font-family: monospace;
          }
          
          @media (prefers-color-scheme: dark) {
            pre, code {
              background-color: rgba(255, 255, 255, 0.1);
            }
          }
          
          table {
            border-collapse: collapse;
            margin: 1em 0;
            max-width: 100%;
          }
          
          td, th {
            padding: 8px;
            border: 1px solid #ddd;
          }
        </style>
      </head>
      <body>
        <div id="email-content">
          ${formattedContent}
        </div>
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            try {
              // Make all links open in new tab
              document.querySelectorAll('a').forEach(link => {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
              });
              
              // Handle images
              document.querySelectorAll('img').forEach(img => {
                img.setAttribute('loading', 'lazy');
              });
              
              // Report height to parent
              const height = document.getElementById('email-content').offsetHeight + 32;
              window.parent.postMessage({ type: 'resize', height: height }, '*');
            } catch (e) {
              console.error(e);
              window.parent.postMessage({ type: 'error' }, '*');
            }
          });
        </script>
      </body>
    </html>
  `;
} 