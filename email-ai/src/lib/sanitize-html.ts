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
      'main', 'nav', 'header', 'footer'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'style', 'width', 'height', 'class',
      'border', 'cellpadding', 'cellspacing', 'align', 'valign', 'color',
      'bgcolor', 'background', 'dir', 'lang', 'target', 'id', 'name',
      'data-*', 'cid', 'srcset', 'loading', 'role', 'aria-*'
    ],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'style'],
    ADD_ATTR: ['target', 'loading'], 
    WHOLE_DOCUMENT: false,
    SANITIZE_DOM: true,
    ALLOW_DATA_ATTR: true
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
        .map(line => line.trim() ? `<p>${line}</p>` : '<br>')
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
          
          body {
            margin: 0;
            padding: 1rem;
            font-family: inherit;
            line-height: inherit;
            color: inherit;
            background-color: transparent;
          }

          /* Preserve original styles */
          div, p, table, td, th, span, a, img {
            max-width: 100%;
          }
          
          img {
            height: auto;
          }
          
          /* Only handle dark mode color inversion */
          @media (prefers-color-scheme: dark) {
            body {
              color: #e1e1e1;
              background-color: transparent;
            }
            
            /* Invert colors while preserving images */
            img {
              filter: none !important;
            }
            
            /* Adjust link colors for dark mode */
            a:link {
              color: #3b82f6;
            }
            
            a:visited {
              color: #8b5cf6;
            }
            
            /* Preserve original borders but adjust color */
            [style*="border"] {
              border-color: #555 !important;
            }
            
            /* Adjust background colors */
            [style*="background"] {
              background-color: rgba(255, 255, 255, 0.05) !important;
            }
            
            /* Preserve but adjust text colors */
            [style*="color"] {
              color: #e1e1e1 !important;
            }
          }

          /* Print styles - restore original colors */
          @media print {
            body {
              color: #000;
              background: #fff;
            }
            
            * {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        ${formattedContent}
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            try {
              // Only process links for security
              document.querySelectorAll('a').forEach(link => {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
              });
              
              // Handle image errors but preserve original styling
              document.querySelectorAll('img').forEach(img => {
                img.setAttribute('loading', 'lazy');
                
                img.onerror = function() {
                  this.style.display = 'none';
                  const placeholder = document.createElement('div');
                  placeholder.style.background = '#f5f5f5';
                  placeholder.style.border = '1px dashed #ccc';
                  placeholder.style.padding = '1em';
                  placeholder.style.textAlign = 'center';
                  placeholder.style.color = '#666';
                  placeholder.style.fontStyle = 'italic';
                  placeholder.textContent = 'Image failed to load';
                  this.parentNode.insertBefore(placeholder, this);
                };
              });
              
              // Report height to parent
              window.parent.postMessage({
                type: 'resize',
                height: document.body.scrollHeight
              }, '*');
              
            } catch (error) {
              console.error('Error processing email content:', error);
            }
          });
        </script>
      </body>
    </html>
  `;
} 