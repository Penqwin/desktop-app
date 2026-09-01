import Dexie, { type EntityTable } from 'dexie';

export interface Document {
  id: string;
  title: string;
  content: string; // Markdown or HTML
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
}

const db = new Dexie('EngDocDatabase') as Dexie & {
  documents: EntityTable<Document, 'id'>;
};

// Schema declaration
db.version(1).stores({
  documents: 'id, parentId, title, createdAt, updatedAt'
});

export { db };
