'use client';

export function isEmailLong(emailBody: string): boolean {
  const textContent = emailBody.replace(/<[^>]*>/g, '').trim();
  return textContent.length > 1000; // More than 1000 characters
}

export function formatEmailDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  if (date.getFullYear() === today.getFullYear()) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatTLDRSummary(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold text
    .split('\n')
    .map(line => {
      if (line.trim().startsWith('* ')) {
        return `<li>${line.trim().substring(2)}</li>`;
      }
      if (line.trim().match(/^ {2,}\+ /)) {
        return `<li class="ml-4">${line.trim().substring(2)}</li>`;
      }
      if (line.trim() === '') {
        return '<br>';
      }
      return line;
    })
    .join('<br>')
    .replace(/(<li>.*?<\/li>(?:<br><li>.*?<\/li>)*)/g, '<ul class="list-disc list-inside space-y-1 ml-4">$1</ul>')
    .replace(/(<li class="ml-4">.*?<\/li>(?:<br><li class="ml-4">.*?<\/li>)*)/g, '<ul class="list-disc list-inside space-y-1 ml-8">$1</ul>')
    .replace(/<br><br>/g, '<div class="my-2"></div>');
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getFileTypeIcon(mimeType: string, filename: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('word') || filename.endsWith('.doc') || filename.endsWith('.docx')) return '📝';
  if (mimeType.includes('excel') || filename.endsWith('.xls') || filename.endsWith('.xlsx')) return '📊';
  if (mimeType.includes('powerpoint') || filename.endsWith('.ppt') || filename.endsWith('.pptx')) return '📊';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return '🗄️';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.startsWith('video/')) return '🎬';
  return '📎';
} 