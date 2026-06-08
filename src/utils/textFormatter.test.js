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

  test('renders unchecked and checked checkboxes with data-line', () => {
    const unchecked = parseNoteText('[] task one');
    expect(unchecked).toContain('type="checkbox"');
    expect(unchecked).toContain('data-line="0"');
    expect(unchecked).not.toContain('checked');
    expect(unchecked).toContain('task one');

    const checked = parseNoteText('[x] done');
    expect(checked).toContain('checked');
    expect(checked).toContain('todo-checked');
  });

  test('consecutive checkboxes are not separated by <br>, mixed lines are', () => {
    const twoBoxes = parseNoteText('[] a\n[] b');
    expect(twoBoxes).not.toContain('<br>');

    const mixed = parseNoteText('hello\n[] a');
    expect(mixed).toContain('<br>');
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

  test('escapes HTML inside checkbox task text', () => {
    const out = parseNoteText('[] <img src=x onerror=alert(1)>');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
  });

  test('escapes quotes and ampersands', () => {
    const out = parseNoteText(`a & "b" 'c'`);
    expect(out).toContain('&amp;');
    expect(out).toContain('&quot;');
    expect(out).toContain('&#039;');
  });
});
