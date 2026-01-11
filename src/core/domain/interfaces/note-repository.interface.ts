/**
 * INoteRepository Interface
 * Repository interface for note data access
 *
 * Implemented using Obsidian API in the Adapters layer
 */

export interface NoteData {
  id: string;
  path: string;
  basename: string;
  content: string;
  metadata: {
    tags?: string[];
    links?: string[];
    backlinks?: string[];
    frontmatter?: Record<string, unknown>;
  };
}

export interface INoteRepository {
  /**
   * Get note by ID
   */
  getNote(noteId: string): Promise<NoteData | null>;

  /**
   * Get note by path
   */
  getNoteByPath(path: string): Promise<NoteData | null>;

  /**
   * Get outlinks (linked notes) of a note
   */
  getLinkedNotes(noteId: string): Promise<NoteData[]>;

  /**
   * Get backlinks (notes referencing this note)
   */
  getBacklinks(noteId: string): Promise<NoteData[]>;

  /**
   * Get notes with specific tag
   */
  getNotesByTag(tag: string): Promise<NoteData[]>;

  /**
   * Get all notes (with filter options)
   */
  getAllNotes(options?: {
    folder?: string;
    excludeFolders?: string[];
  }): Promise<NoteData[]>;

  /**
   * Check if note exists
   */
  exists(noteId: string): Promise<boolean>;

  /**
   * Search notes by concept/keyword
   * Search in title and content to find related notes
   */
  searchNotes(query: string, options?: {
    excludeFolders?: string[];
    limit?: number;
  }): Promise<NoteData[]>;
}
