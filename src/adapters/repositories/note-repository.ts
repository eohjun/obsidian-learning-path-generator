/**
 * NoteRepository Adapter
 * Note repository implementation using Obsidian API
 */

import { App, TFile, CachedMetadata, getAllTags, normalizePath } from 'obsidian';
import { INoteRepository, NoteData } from '../../core/domain';
import { generateNoteId } from '../../core/domain/utils/note-id';

export class NoteRepository implements INoteRepository {
  constructor(private readonly app: App) {}

  async getNote(noteId: string): Promise<NoteData | null> {
    // noteId is hash-based ID (Vault Embeddings compatible)
    const files = this.app.vault.getMarkdownFiles();
    const file = files.find((f) => generateNoteId(f.path) === noteId);

    if (!file) {
      return null;
    }

    return this.fileToNoteData(file);
  }

  async getNoteByPath(path: string): Promise<NoteData | null> {
    const normalizedPath = normalizePath(path);
    const file = this.app.vault.getAbstractFileByPath(normalizedPath);

    if (!file || !(file instanceof TFile)) {
      return null;
    }

    return this.fileToNoteData(file);
  }

  async getLinkedNotes(noteId: string): Promise<NoteData[]> {
    const note = await this.getNote(noteId);
    if (!note || !note.metadata.links) {
      return [];
    }

    const linkedNotes: NoteData[] = [];
    for (const linkId of note.metadata.links) {
      const linkedNote = await this.getNote(linkId);
      if (linkedNote) {
        linkedNotes.push(linkedNote);
      }
    }

    return linkedNotes;
  }

  async getBacklinks(noteId: string): Promise<NoteData[]> {
    const note = await this.getNote(noteId);
    if (!note || !note.metadata.backlinks) {
      return [];
    }

    const backlinkNotes: NoteData[] = [];
    for (const backlinkId of note.metadata.backlinks) {
      const backlinkNote = await this.getNote(backlinkId);
      if (backlinkNote) {
        backlinkNotes.push(backlinkNote);
      }
    }

    return backlinkNotes;
  }

  async getNotesByTag(tag: string): Promise<NoteData[]> {
    const files = this.app.vault.getMarkdownFiles();
    const notes: NoteData[] = [];

    // Normalize tag (add # if not present)
    const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache) continue;

      const fileTags = getAllTags(cache) ?? [];
      if (fileTags.includes(normalizedTag)) {
        const noteData = await this.fileToNoteData(file);
        if (noteData) {
          notes.push(noteData);
        }
      }
    }

    return notes;
  }

  async getAllNotes(options?: {
    folder?: string;
    excludeFolders?: string[];
  }): Promise<NoteData[]> {
    let files = this.app.vault.getMarkdownFiles();
    console.log(`[NoteRepository] Total markdown files in vault: ${files.length}`);

    // Filter by folder (cross-platform safe)
    if (options?.folder) {
      const normalizedFolder = normalizePath(options.folder);
      const folderPath = normalizedFolder.endsWith('/')
        ? normalizedFolder
        : `${normalizedFolder}/`;
      files = files.filter((f) => f.path.startsWith(folderPath));
      console.log(`[NoteRepository] After folder filter (${options.folder}): ${files.length}`);
    }

    // Exclude folders (cross-platform safe)
    if (options?.excludeFolders && options.excludeFolders.length > 0) {
      const beforeCount = files.length;
      files = files.filter((f) => {
        return !options.excludeFolders!.some((excludeFolder) => {
          const normalizedExclude = normalizePath(excludeFolder);
          const excludePath = normalizedExclude.endsWith('/')
            ? normalizedExclude
            : `${normalizedExclude}/`;
          return f.path.startsWith(excludePath);
        });
      });
      console.log(`[NoteRepository] After excludeFolders filter: ${files.length} (excluded ${beforeCount - files.length})`);
    }

    const notes: NoteData[] = [];
    for (const file of files) {
      const noteData = await this.fileToNoteData(file);
      if (noteData) {
        notes.push(noteData);
      }
    }

    console.log(`[NoteRepository] Final notes count: ${notes.length}`);
    return notes;
  }

  async exists(noteId: string): Promise<boolean> {
    const files = this.app.vault.getMarkdownFiles();
    return files.some((f) => generateNoteId(f.path) === noteId);
  }

  async searchNotes(
    query: string,
    options?: {
      excludeFolders?: string[];
      limit?: number;
    }
  ): Promise<NoteData[]> {
    const allNotes = await this.getAllNotes({
      excludeFolders: options?.excludeFolders,
    });

    const queryLower = query.toLowerCase();
    const results: NoteData[] = [];

    for (const note of allNotes) {
      // Search in title or content
      const titleMatch = note.basename.toLowerCase().includes(queryLower);
      const contentMatch = note.content.toLowerCase().includes(queryLower);

      if (titleMatch || contentMatch) {
        results.push(note);
      }

      // Limit results
      if (options?.limit && results.length >= options.limit) {
        break;
      }
    }

    return results;
  }

  /**
   * Convert TFile to NoteData
   */
  private async fileToNoteData(file: TFile): Promise<NoteData | null> {
    try {
      const content = await this.app.vault.read(file);
      const cache = this.app.metadataCache.getFileCache(file);

      return {
        id: generateNoteId(file.path), // Hash-based ID (Vault Embeddings compatible)
        path: file.path,
        basename: file.basename,
        content,
        metadata: {
          tags: this.extractTags(cache),
          links: this.extractLinks(cache),
          backlinks: this.extractBacklinks(file),
          frontmatter: cache?.frontmatter ?? {},
        },
      };
    } catch (error) {
      console.error(`Error reading file ${file.path}:`, error);
      return null;
    }
  }

  /**
   * Extract tags from cache
   */
  private extractTags(cache: CachedMetadata | null): string[] {
    if (!cache) return [];
    return getAllTags(cache) ?? [];
  }

  /**
   * Extract links from cache (basename only)
   */
  private extractLinks(cache: CachedMetadata | null): string[] {
    if (!cache?.links) return [];

    return cache.links
      .map((link) => {
        // Extract basename from [[Note Name]] or [[path/to/Note Name]]
        const linkPath = link.link;
        const basename = linkPath.split('/').pop() ?? linkPath;
        // Remove extension
        return basename.replace(/\.md$/, '');
      })
      .filter((name, index, arr) => arr.indexOf(name) === index); // Remove duplicates
  }

  /**
   * Extract backlinks
   */
  private extractBacklinks(file: TFile): string[] {
    const backlinks: string[] = [];
    const resolvedLinks = this.app.metadataCache.resolvedLinks;

    for (const [sourcePath, links] of Object.entries(resolvedLinks)) {
      if (links[file.path]) {
        const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath);
        if (sourceFile instanceof TFile) {
          backlinks.push(sourceFile.basename);
        }
      }
    }

    return backlinks;
  }
}
