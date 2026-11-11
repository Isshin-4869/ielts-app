import { describe, expect, it } from 'vitest';
import { normalizeSpelling } from '../../../src/lang/en/spelling';

const same = (a: string, b: string) => expect(normalizeSpelling(a)).toBe(normalizeSpelling(b));

describe('normalizeSpelling（英米のつづり）', () => {
  it('-ise / -ize とその変化形', () => {
    same('recognise', 'recognize');
    same('economised', 'economized');
    same('apologising', 'apologizing');
  });
  it('-isation / -ization', () => same('organisation', 'organization'));
  it('-yse / -yze', () => same('analyse', 'analyze'));
  it('-our / -or', () => {
    same('colour', 'color');
    same('favourite', 'favorite');
    same('labours', 'labors');
  });
  it('-tre / -ter', () => same('centre', 'center'));
  it('-ogue / -og', () => same('catalogue', 'catalog'));
  it('-ence / -ense', () => same('defence', 'defense'));
  it('子音の重ね', () => same('travelled', 'traveled'));
  it('大文字・空白', () => same('  Traffic   Jam ', 'traffic jam'));
  it('関係ない語は変えない', () => {
    expect(normalizeSpelling('zorble')).toBe('zorble');
    expect(normalizeSpelling('being')).toBe('being');
  });
});
