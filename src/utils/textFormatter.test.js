import { parseNoteText } from './textFormatter';

describe('parseNoteText formatting', () => {
  test('returns empty string for falsy input', () => {
    expect(parseNoteText('')).toBe('');
    expect(parseNoteText(undefined)).toBe('');
    expect(parseNoteText(null)).toBe('');
  });

  test('renders bold, italic, underline, strikethrough', () => {
    expect(parseNoteText('**b**')).toContain('<strong>b</strong>');
    expect(parseNoteText('_i_')).toContain('<em>i</em>');
    expect(parseNoteText('__u__')).toContain('<u>u</u>');
    expect(parseNoteText('~~s~~')).toContain('<s>s</s>');
  });

  test('separates lines with <br>', () => {
    expect(parseNoteText('a\nb')).toBe('a<br>b');
  });
});

describe('parseNoteText XSS safety', () => {
  test('escapes raw HTML tags so they cannot execute', () => {
    const out = parseNoteText('<img src=x onerror="alert(1)">');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
  });

  test('escapes script tags', () => {
    const out = parseNoteText('<script>alert(1)</script>');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });

  test('escapes quotes and ampersands', () => {
    const out = parseNoteText(`a & "b" 'c'`);
    expect(out).toContain('&amp;');
    expect(out).toContain('&quot;');
    expect(out).toContain('&#039;');
  });
});
