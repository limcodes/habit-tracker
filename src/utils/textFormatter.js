/**
 * Parses text with markdown-like formatting
 * Supports:
 * - Bold: **text**
 * - Italic: *text* or _text_
 * - Underline: __text__
 * - Strikethrough: ~~text~~
 */
export const parseNoteText = (text) => {
  if (!text) return '';
  
  // Escape HTML to prevent XSS
  let safeText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  // Apply formatting
  safeText = safeText
    // Bold: **text**
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic: *text* or _text_
    .replace(/(\*|_)(.*?)\1/g, '<em>$2</em>')
    // Underline: __text__
    .replace(/__(.*?)__/g, '<u>$1</u>')
    // Strikethrough: ~~text~~
    .replace(/~~(.*?)~~/g, '<s>$1</s>');
  
  // Replace new lines with <br>
  safeText = safeText.replace(/\n/g, '<br>');
  
  return safeText;
};
