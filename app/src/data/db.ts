// 端末の DB（IndexedDB / Dexie）。DESIGN.md 12.1。

import Dexie, { type Table } from 'dexie';
import type { Progress, ReviewLog } from '../engine/types';
import type { Item } from './types';

export type MetaRow = { key: string; value: unknown };

export class AppDB extends Dexie {
  items!: Table<Item, string>;
  progress!: Table<Progress, string>;
  logs!: Table<ReviewLog, string>;
  meta!: Table<MetaRow, string>;

  constructor(name = 'ielts-app') {
    super(name);
    this.version(1).stores({
      items: 'id, order, block, kind',
      progress: 'itemId, state',
      logs: 'id, itemId, at, day, phase',
      meta: 'key',
    });
  }
}

export const db = new AppDB();
