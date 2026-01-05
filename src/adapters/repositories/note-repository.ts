/**
 * NoteRepository Adapter
 * Obsidian API를 사용한 노트 저장소 구현
 */

import { App, TFile, CachedMetadata, getAllTags } from 'obsidian';
import { INoteRepository, NoteData } from '../../core/domain';

export class NoteRepository implements INoteRepository {
  constructor(private readonly app: App) {}

  async getNote(noteId: string): Promise<NoteData | null> {
    // noteId는 파일 basename (확장자 제외)
    const files = this.app.vault.getMarkdownFiles();
    const file = files.find((f) => f.basename === noteId);

    if (!file) {
      return null;
    }

    return this.fileToNoteData(file);
  }

  async getNoteByPath(path: string): Promise<NoteData | null> {
    const file = this.app.vault.getAbstractFileByPath(path);

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

    // Filter by folder
    if (options?.folder) {
      const folderPath = options.folder.endsWith('/')
        ? options.folder
        : `${options.folder}/`;
      files = files.filter((f) => f.path.startsWith(folderPath));
    }

    // Exclude folders
    if (options?.excludeFolders && options.excludeFolders.length > 0) {
      files = files.filter((f) => {
        return !options.excludeFolders!.some((excludeFolder) => {
          const excludePath = excludeFolder.endsWith('/')
            ? excludeFolder
            : `${excludeFolder}/`;
          return f.path.startsWith(excludePath);
        });
      });
    }

    const notes: NoteData[] = [];
    for (const file of files) {
      const noteData = await this.fileToNoteData(file);
      if (noteData) {
        notes.push(noteData);
      }
    }

    return notes;
  }

  async exists(noteId: string): Promise<boolean> {
    const files = this.app.vault.getMarkdownFiles();
    return files.some((f) => f.basename === noteId);
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
      // 제목 또는 내용에서 검색
      const titleMatch = note.basename.toLowerCase().includes(queryLower);
      const contentMatch = note.content.toLowerCase().includes(queryLower);

      if (titleMatch || contentMatch) {
        results.push(note);
      }

      // 결과 수 제한
      if (options?.limit && results.length >= options.limit) {
        break;
      }
    }

    return results;
  }

  /**
   * TFile을 NoteData로 변환
   */
  private async fileToNoteData(file: TFile): Promise<NoteData | null> {
    try {
      const content = await this.app.vault.read(file);
      const cache = this.app.metadataCache.getFileCache(file);

      return {
        id: file.basename,
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
   * 캐시에서 태그 추출
   */
  private extractTags(cache: CachedMetadata | null): string[] {
    if (!cache) return [];
    return getAllTags(cache) ?? [];
  }

  /**
   * 캐시에서 링크 추출 (basename만)
   */
  private extractLinks(cache: CachedMetadata | null): string[] {
    if (!cache?.links) return [];

    return cache.links
      .map((link) => {
        // [[Note Name]] 또는 [[path/to/Note Name]] 에서 basename 추출
        const linkPath = link.link;
        const basename = linkPath.split('/').pop() ?? linkPath;
        // 확장자 제거
        return basename.replace(/\.md$/, '');
      })
      .filter((name, index, arr) => arr.indexOf(name) === index); // 중복 제거
  }

  /**
   * 백링크 추출
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
