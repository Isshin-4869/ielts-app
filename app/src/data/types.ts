// items.json の型。scripts/convert/schema.py と対応させる（DESIGN.md 3.2）。

export type Meaning = { pos: string; text: string };

export type Cloze = { start: number; length: number; form: string };

export type Example = {
  en: string;
  ja?: string;
  source: string;
  incomplete: boolean;
  cloze?: Cloze;
};

export type Item = {
  id: string;
  kind: 'word' | 'phrase';
  origin: 'quizlet' | 'audio-only' | 'phrase';
  sourceNos: string[];
  order: number;
  block: number;
  headword?: string;
  meanings?: Meaning[];
  meaningRaw?: string;
  synonyms: string[];
  antonyms: string[];
  relationSource?: 'quizlet' | 'wordnet';
  example?: Example;
};
