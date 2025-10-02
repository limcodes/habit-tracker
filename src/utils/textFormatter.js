/**
 * Parses text with markdown-like formatting
 * Supports:
 * - Bold: **text**
 * - Italic: *text* or _text_
 * - Underline: __text__
 * - Strikethrough: ~~text~~
 * - Todo checkboxes: [] task or [x] task
 */
export const parseNoteText = (text, onCheckboxToggle) => {
  if (!text) return '';
  
  // Escape HTML to prevent XSS
  let safeText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  // Track line index for checkbox identification
  let lineIndex = 0;
  
  // Split by newlines to process checkboxes line by line
  const lines = safeText.split('\n').map((line, index) => {
    const currentLineIndex = lineIndex++;
    
    // Check for unchecked checkbox: [] task
    if (line.match(/^\[\]\s+(.+)$/)) {
      const taskText = line.replace(/^\[\]\s+/, '');
      return {
        type: 'checkbox',
        html: `<label class="todo-item" data-line="${currentLineIndex}">
          <input type="checkbox" class="todo-checkbox" data-line="${currentLineIndex}" />
          <span class="todo-text">${taskText}</span>
        </label>`
      };
    }
    
    // Check for checked checkbox: [x] task
    if (line.match(/^\[x\]\s+(.+)$/i)) {
      const taskText = line.replace(/^\[x\]\s+/i, '');
      return {
        type: 'checkbox',
        html: `<label class="todo-item" data-line="${currentLineIndex}">
          <input type="checkbox" class="todo-checkbox" data-line="${currentLineIndex}" checked />
          <span class="todo-text todo-checked">${taskText}</span>
        </label>`
      };
    }
    
    // Apply other formatting to non-checkbox lines
    let formattedLine = line
      // Bold: **text**
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic: *text* or _text_
      .replace(/(\*|_)(.*?)\1/g, '<em>$2</em>')
      // Underline: __text__
      .replace(/__(.*?)__/g, '<u>$1</u>')
      // Strikethrough: ~~text~~
      .replace(/~~(.*?)~~/g, '<s>$1</s>');
    
    return {
      type: 'text',
      html: formattedLine
    };
  });
  
  // Join lines, but don't add <br> between consecutive checkboxes
  let result = '';
  for (let i = 0; i < lines.length; i++) {
    result += lines[i].html;
    
    // Add <br> only if:
    // - Not the last line
    // - Next line is not a checkbox OR current line is not a checkbox
    if (i < lines.length - 1) {
      const currentIsCheckbox = lines[i].type === 'checkbox';
      const nextIsCheckbox = lines[i + 1].type === 'checkbox';
      
      if (!currentIsCheckbox || !nextIsCheckbox) {
        result += '<br>';
      }
    }
  }
  
  return result;
};
