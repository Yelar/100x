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
      'main', 'nav', 'header', 'footer', 'style'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'style', 'width', 'height', 'class',
      'border', 'cellpadding', 'cellspacing', 'align', 'valign', 'color',
      'bgcolor', 'background', 'dir', 'lang', 'target', 'id', 'name',
      'data-*', 'cid', 'srcset', 'loading', 'role', 'aria-*', 'face',
      'size', 'type', 'start', 'value'
    ],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    ADD_ATTR: ['target', 'loading'], 
    WHOLE_DOCUMENT: false,
    SANITIZE_DOM: true,
    ALLOW_DATA_ATTR: true,
    KEEP_CONTENT: true,
    USE_PROFILES: { html: true }
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
          
          body {
            margin: 0;
            padding: 1rem;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.5;
            max-width: 100%;
          }

          /* Better base styling */
          p, div, span, li, td, th {
            max-width: 100%;
            word-wrap: break-word;
          }

          /* Make images responsive */
          img {
            max-width: 100%;
            height: auto;
          }

          /* Improve table rendering */
          table {
            max-width: 100%;
            border-collapse: collapse;
          }

          /* Handle gmail-specific divs */
          .gmail_quote, .gmail_attr {
            margin-top: 1rem;
            padding-left: 1rem;
            border-left: 3px solid #ccc;
            color: inherit;
          }

          /* Force tables to be responsive */
          table, thead, tbody, tr {
            max-width: 100% !important;
            width: auto !important;
            display: block !important;
          }
          
          td, th {
            display: inline-block !important;
            max-width: 100% !important;
            width: auto !important;
          }

          /* Enhanced link styling for better visibility */
          a, a[href], a:link, a:visited, .link, [href], [data-href] {
            color: #0066cc !important;
            text-decoration: underline !important;
            text-decoration-thickness: 1px !important;
            font-weight: 500 !important;
            transition: all 0.2s ease !important;
            border-bottom: 1px solid rgba(0, 102, 204, 0.2) !important;
            padding-bottom: 1px !important;
          }
          
          a:hover, a[href]:hover, [href]:hover {
            color: #004999 !important;
            border-bottom-color: rgba(0, 73, 153, 0.5) !important;
          }

          /* Default blockquote styling */
          blockquote {
            margin-left: 1rem;
            padding-left: 1rem;
            border-left: 3px solid #ccc;
            color: inherit;
          }

          /* Light mode styles */
          @media (prefers-color-scheme: light) {
            body {
              color: #333;
              background-color: #fff;
            }
            
            /* Enhanced link styling for light mode */
            a, a[href], a:link, a:visited, .link, [href], [data-href] {
              color: #0066cc !important;
              border-bottom: 1px solid rgba(0, 102, 204, 0.3) !important;
            }
            
            a:hover, a[href]:hover, [href]:hover {
              color: #004999 !important;
              background-color: rgba(0, 102, 204, 0.05) !important;
            }
            
            /* Ensure all text has sufficient contrast */
            [style*="color: rgb(255, 255, 255)"],
            [style*="color: #fff"],
            [style*="color: white"],
            [style*="color:#fff"] {
              color: #333 !important;
            }
            
            blockquote {
              border-color: #ddd;
            }
          }

          /* Dark mode styles */
          @media (prefers-color-scheme: dark) {
            body {
              color: #e1e1e1;
              background-color: #121212;
            }

            /* Invert text colors for better readability */
            body, div, p, span, td, th, li {
              color: #e1e1e1;
            }

            /* Enhanced link styling for dark mode */
            a, a[href], a:link, a:visited, .link, [href], [data-href] {
              color: #4da3ff !important;
              border-bottom: 1px solid rgba(77, 163, 255, 0.3) !important;
              text-decoration-color: rgba(77, 163, 255, 0.5) !important;
            }
            
            a:hover, a[href]:hover, [href]:hover {
              color: #74b6ff !important;
              background-color: rgba(77, 163, 255, 0.1) !important;
            }

            /* Handle dark text colors */
            [style*="color: rgb(0, 0, 0)"],
            [style*="color: #000"],
            [style*="color: black"],
            [style*="color:#000"],
            [style*="color: rgb(51, 51, 51)"],
            [style*="color: #333"],
            [style*="color:#333"] {
              color: #e1e1e1 !important;
            }

            /* Handle dark text colors */
            [style*="color: rgb(68, 68, 68)"],
            [style*="color: #444"],
            [style*="color:#444"] {
              color: #d1d1d1 !important;
            }

            /* Handle medium text colors */
            [style*="color: rgb(102, 102, 102)"],
            [style*="color: #666"],
            [style*="color:#666"] {
              color: #b1b1b1 !important;
            }

            /* Handle light text colors */
            [style*="color: rgb(153, 153, 153)"],
            [style*="color: #999"],
            [style*="color:#999"] {
              color: #919191 !important;
            }

            /* Make white text slightly dimmer */
            [style*="color: rgb(255, 255, 255)"],
            [style*="color: #fff"],
            [style*="color: white"],
            [style*="color:#fff"] {
              color: #e1e1e1 !important;
            }

            /* Handle white backgrounds */
            [style*="background-color: rgb(255, 255, 255)"],
            [style*="background-color: #fff"],
            [style*="background-color: white"],
            [style*="background:#fff"],
            [style*="background: #fff"],
            [style*="background-color:#fff"] {
              background-color: transparent !important;
            }

            /* Handle light backgrounds */
            [style*="background-color: rgb(245, 245, 245)"],
            [style*="background-color: #f5f5f5"],
            [style*="background-color:#f5f5f5"] {
              background-color: rgba(255, 255, 255, 0.05) !important;
            }

            /* Handle borders */
            [style*="border-color: rgb(221, 221, 221)"],
            [style*="border-color: #ddd"],
            [style*="border-color:#ddd"],
            [style*="border: 1px solid #ddd"],
            [style*="border:1px solid #ddd"] {
              border-color: #4a4a4a !important;
            }

            /* Preserve images */
            img {
              filter: brightness(0.9);
            }

            /* Handle tables */
            table {
              border-color: #4a4a4a;
            }

            /* Handle font colors from font tag */
            font[color="black"],
            font[color="#000000"] {
              color: #e1e1e1 !important;
            }

            /* Add borders around tables for better visibility in dark mode */
            table {
              border: 1px solid #4a4a4a;
            }

            td, th {
              border: 1px solid #3a3a3a;
            }

            blockquote {
              border-color: #4a4a4a;
            }
          }
        </style>
      </head>
      <body>
        ${formattedContent}
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            try {
              // Fix width attributes on tables and cells
              document.querySelectorAll('table, td, th').forEach(el => {
                const widthValue = el.getAttribute('width');
                if (widthValue) {
                  // If it's a percentage, keep it
                  if (widthValue.includes('%')) {
                    el.style.width = widthValue;
                  } else {
                    // Otherwise set max-width instead of fixed width
                    el.style.maxWidth = widthValue + 'px';
                    el.removeAttribute('width');
                  }
                }
              });

              // Enhance links for better visibility
              document.querySelectorAll('a').forEach(link => {
                // Force visible styling on links
                link.style.setProperty('color', link.matches(':hover') ? '#004999' : '#0066cc', 'important');
                link.style.setProperty('text-decoration', 'underline', 'important');
                link.style.setProperty('font-weight', '500', 'important');
                
                // Add target blank to external links
                if (link.hasAttribute('href')) {
                  link.setAttribute('target', '_blank');
                  link.setAttribute('rel', 'noopener noreferrer');
                }
                
                // Add hover event listeners
                link.addEventListener('mouseover', function() {
                  this.style.setProperty('color', 
                    window.matchMedia('(prefers-color-scheme: dark)').matches ? '#74b6ff' : '#004999', 
                    'important'
                  );
                  this.style.backgroundColor = 'rgba(0, 102, 204, 0.1)';
                });
                
                link.addEventListener('mouseout', function() {
                  this.style.setProperty('color', 
                    window.matchMedia('(prefers-color-scheme: dark)').matches ? '#4da3ff' : '#0066cc', 
                    'important'
                  );
                  this.style.backgroundColor = 'transparent';
                });
              });
              
              // Handle images
              document.querySelectorAll('img').forEach(img => {
                img.setAttribute('loading', 'lazy');
                // Remove inline height to allow proper scaling
                if (img.getAttribute('height')) {
                  img.style.maxHeight = img.getAttribute('height') + 'px';
                  img.removeAttribute('height');
                }
                // Make sure images are responsive
                img.style.maxWidth = '100%';
                img.onerror = function() {
                  if (!this.hasAttribute('data-error-handled')) {
                    this.setAttribute('data-error-handled', 'true');
                    const placeholder = document.createElement('div');
                    placeholder.style.padding = '1em';
                    placeholder.style.textAlign = 'center';
                    placeholder.style.border = '1px dashed currentColor';
                    placeholder.style.opacity = '0.7';
                    placeholder.textContent = '🖼️ Image failed to load';
                    this.parentNode.insertBefore(placeholder, this);
                    this.style.display = 'none';
                  }
                };
              });

              // Report height to parent
              const updateHeight = () => {
                window.parent.postMessage({
                  type: 'resize',
                  height: document.body.scrollHeight
                }, '*');
              };

              // Update height on image load
              document.querySelectorAll('img').forEach(img => {
                img.addEventListener('load', updateHeight);
              });

              // Initial height update
              updateHeight();

              // Update height on font load
              if ('fonts' in document) {
                document.fonts.ready.then(updateHeight);
              }
              
              // Handle window resize
              window.addEventListener('resize', updateHeight);
            } catch (error) {
              console.error('Error processing email content:', error);
              window.parent.postMessage({ type: 'error' }, '*');
            }
          });
        </script>
      </body>
    </html>
  `;
} 