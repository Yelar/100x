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
          
          * {
            box-sizing: border-box;
          }
          
          html, body {
            height: auto;
            margin: 0;
            padding: 0;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 8px;
            color: #333;
            background-color: transparent;
            line-height: 1.5;
            font-size: 16px;
            overflow-wrap: break-word;
            word-wrap: break-word;
          }
          
          /* Make all content responsive */
          img, table, div, p {
            max-width: 100% !important;
          }
          
          /* Remove fixed heights */
          [style*="height:"], [style*="height="] {
            height: auto !important;
          }
          
          /* Email table containers */
          table {
            width: auto !important;
            margin: 4px 0;
            border-collapse: collapse;
          }
          
          td, th {
            padding: 6px;
            border: 1px solid #ddd;
          }

          a {
            color: #0070f3;
            text-decoration: underline;
          }
          
          @media (prefers-color-scheme: dark) {
            body {
              color: #e1e1e1;
            }
            
            a {
              color: #3b82f6;
            }
            
            table, td, th {
              border-color: #555;
            }
          }
          
          pre, code {
            white-space: pre-wrap;
            background-color: rgba(0, 0, 0, 0.05);
            border-radius: 3px;
            padding: 0.2em 0.4em;
            font-family: monospace;
          }
          
          blockquote {
            border-left: 3px solid #ddd;
            padding-left: 16px;
            margin-left: 0;
            color: #555;
          }
          
          @media (prefers-color-scheme: dark) {
            pre, code {
              background-color: rgba(255, 255, 255, 0.1);
            }
            
            blockquote {
              border-color: #555;
              color: #aaa;
            }
          }
        </style>
      </head>
      <body>
        ${formattedContent}
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            try {
              // Make all links open in new tab
              document.querySelectorAll('a').forEach(link => {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
              });
              
              // Fix image display
              document.querySelectorAll('img').forEach(img => {
                img.setAttribute('loading', 'lazy');
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                
                img.onerror = function() {
                  this.style.display = 'none';
                };
              });
              
              // Remove empty divs and spacing elements
              document.querySelectorAll('div:empty, span:empty').forEach(el => {
                el.remove();
              });
              
              // Calculate height precisely without adding extra space
              function reportHeight() {
                // Get just the exact content height
                const height = document.body.offsetHeight;
                window.parent.postMessage({ type: 'resize', height: height }, '*');
              }
              
              // Initial height report
              reportHeight();
              
              // Additional check after all content has loaded
              window.addEventListener('load', reportHeight);
              
              // Safety check
              setTimeout(reportHeight, 500);
            } catch (e) {
              console.error('Error in email iframe:', e);
              window.parent.postMessage({ type: 'error' }, '*');
            }
          });
        </script>
      </body>
    </html>
  `;
} 