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
  const safeText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // Format each line. Order matters: the double-marker patterns (**, __) must
  // run before the single-marker italic pattern, otherwise `_..._` would
  // consume the underscores of `__underline__` first.
  const formatted = safeText.split('\n').map((line) =>
    line
      // Bold: **text**
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Underline: __text__
      .replace(/__(.*?)__/g, '<u>$1</u>')
      // Strikethrough: ~~text~~
      .replace(/~~(.*?)~~/g, '<s>$1</s>')
      // Italic: *text* or _text_
      .replace(/(\*|_)(.*?)\1/g, '<em>$2</em>')
  );

  return formatted.join('<br>');
};
