/**
 * INoteRepository Interface
 * 노트 데이터 접근을 위한 저장소 인터페이스
 *
 * Adapters 레이어에서 Obsidian API를 사용해 구현
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
   * ID로 노트 조회
   */
  getNote(noteId: string): Promise<NoteData | null>;

  /**
   * 경로로 노트 조회
   */
  getNoteByPath(path: string): Promise<NoteData | null>;

  /**
   * 노트의 아웃링크(연결된 노트들) 조회
   */
  getLinkedNotes(noteId: string): Promise<NoteData[]>;

  /**
   * 노트의 백링크(이 노트를 참조하는 노트들) 조회
   */
  getBacklinks(noteId: string): Promise<NoteData[]>;

  /**
   * 특정 태그를 가진 노트들 조회
   */
  getNotesByTag(tag: string): Promise<NoteData[]>;

  /**
   * 모든 노트 조회 (필터 옵션)
   */
  getAllNotes(options?: {
    folder?: string;
    excludeFolders?: string[];
  }): Promise<NoteData[]>;

  /**
   * 노트 존재 여부 확인
   */
  exists(noteId: string): Promise<boolean>;
}
