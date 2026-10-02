/**
 * Supabase-backed API adapter.
 *
 * This class keeps the EXACT same interface as the old FastAPI client
 * (apiClient.get/post/put/delete with /api/... endpoint strings), so every
 * screen in the app works unchanged — the calls are just routed to Supabase
 * (PostgREST tables, RPC functions, and Supabase Auth) instead of the
 * Python backend. The backend folder can be deleted entirely.
 */
import { supabase } from '@/src/lib/supabase';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Re-export so existing screens/hooks keep working if they imported it. */
export function setUnauthorizedHandler(_handler: (() => void) | null) {
  // Supabase auto-refreshes expired tokens, so no manual handling is needed.
}

function toApiError(error: any): ApiError {
  const msg = error?.message ?? 'Request failed';
  // PostgREST: 42501 = RLS violation, P0001 = raised exception (e.g. admin check)
  if (error?.code === '42501' || /admin access required/i.test(msg)) {
    return new ApiError(403, 'Admin access required');
  }
  return new ApiError(400, msg);
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 14)}`;
}

class ApiClient {
  // ------------------------------------------------------------------ GET
  async get<T>(endpoint: string): Promise<T> {
    const [path, queryString] = endpoint.split('?');
    const segments = path.split('/').filter(Boolean); // e.g. ['api','books','id','chapters']

    // --- Search ---
    if (path === '/api/search') {
      const q = new URLSearchParams(queryString).get('q') ?? '';
      const { data, error } = await supabase.rpc('search_verses', { q });
      if (error) throw toApiError(error);
      return data as T;
    }

    // --- Admin analytics ---
    if (path === '/api/admin/analytics') {
      const { data, error } = await supabase.rpc('admin_analytics');
      if (error) throw toApiError(error);
      return data as T;
    }

    // --- Admin: list users (profiles; RLS restricts to admin) ---
    if (path === '/api/admin/users') {
      const { data, error } = await supabase
        .from('profiles')
        .select('id as user_id, email, name, picture, role, created_at')
        .order('created_at', { ascending: false });
      if (error) throw toApiError(error);
      return data as T;
    }

    // --- Admin listings ---
    if (path === '/api/admin/books')    return this.fromSelect('books', 'order');
    if (path === '/api/admin/chapters') return this.fromSelect('chapters', 'chapter_number');
    if (path === '/api/admin/verses')   return this.fromSelect('verses', 'verse_number');

    // --- Bookmarks ---
    if (path === '/api/bookmarks') {
      const { data, error } = await supabase
        .from('bookmarks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw toApiError(error);
      return data as T;
    }

    // --- Library routes ---
    if (path === '/api/categories') {
      return this.fromSelect('categories', 'order');
    }

    if (segments[1] === 'categories' && segments.length === 3) {
      return this.single('categories', 'category_id', segments[2]);
    }

    if (segments[1] === 'categories' && segments[3] === 'books') {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('category_id', segments[2])
        .order('order', { ascending: true });
      if (error) throw toApiError(error);
      return data as T;
    }

    if (path === '/api/books') {
      return this.fromSelect('books', 'order');
    }

    if (segments[1] === 'books' && segments.length === 3) {
      return this.single('books', 'book_id', segments[2]);
    }

    if (segments[1] === 'books' && segments[3] === 'chapters') {
      const { data, error } = await supabase
        .from('chapters')
        .select('*')
        .eq('book_id', segments[2])
        .order('chapter_number', { ascending: true });
      if (error) throw toApiError(error);
      return data as T;
    }

    if (segments[1] === 'chapters' && segments.length === 3) {
      return this.single('chapters', 'chapter_id', segments[2]);
    }

    if (segments[1] === 'chapters' && segments[3] === 'verses') {
      const { data, error } = await supabase
        .from('verses')
        .select('*')
        .eq('chapter_id', segments[2])
        .order('verse_number', { ascending: true });
      if (error) throw toApiError(error);
      return data as T;
    }

    throw new ApiError(404, `Unknown endpoint: ${endpoint}`);
  }

  // ----------------------------------------------------------------- POST
  async post<T>(endpoint: string, data?: any): Promise<T> {
    const segments = endpoint.split('/').filter(Boolean);

    if (endpoint === '/api/bookmarks' && data) {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new ApiError(401, 'Not authenticated');

      // Duplicate check (matches old backend behavior: return existing)
      const { data: existing } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', user.id)
        .eq('verse_id', data.verse_id)
        .maybeSingle();
      if (existing) return existing as T;

      const { data: created, error } = await supabase
        .from('bookmarks')
        .insert({ ...data, user_id: user.id })
        .select()
        .single();
      if (error) throw toApiError(error);
      return created as T;
    }

    const tableMap: Record<string, string> = {
      '/api/admin/categories': 'categories',
      '/api/admin/books': 'books',
      '/api/admin/chapters': 'chapters',
      '/api/admin/verses': 'verses',
    };
    const table = tableMap[endpoint];
    if (table && data) {
      const idPrefix = table.slice(0, 3); // cat, boo, cha, ver
      const idField = table === 'categories' ? 'category_id'
        : table === 'books' ? 'book_id'
        : table === 'chapters' ? 'chapter_id'
        : 'verse_id';
      const { data: created, error } = await supabase
        .from(table)
        .insert({ ...data, [idField]: newId(idPrefix) })
        .select()
        .single();
      if (error) throw toApiError(error);
      return created as T;
    }

    throw new ApiError(404, `Unknown endpoint: ${endpoint}`);
  }

  // ------------------------------------------------------------------ PUT
  async put<T>(endpoint: string, data?: any): Promise<T> {
    const segments = endpoint.split('/').filter(Boolean);
    const tableMap: Record<string, [string, string]> = {
      categories: ['categories', 'category_id'],
      books: ['books', 'book_id'],
      chapters: ['chapters', 'chapter_id'],
      verses: ['verses', 'verse_id'],
    };
    // /api/admin/{table}/{id}
    if (segments[1] === 'admin' && segments.length === 4 && data) {
      const [table, idField] = tableMap[segments[2]] ?? [];
      if (table) {
        const { data: updated, error } = await supabase
          .from(table)
          .update(data)
          .eq(idField, segments[3])
          .select()
          .single();
        if (error) throw toApiError(error);
        return updated as T;
      }
    }
    throw new ApiError(404, `Unknown endpoint: ${endpoint}`);
  }

  // --------------------------------------------------------------- DELETE
  async delete<T = void>(endpoint: string): Promise<T> {
    const segments = endpoint.split('/').filter(Boolean);

    // /api/bookmarks/{bookmark_id}
    if (segments[1] === 'bookmarks' && segments.length === 3) {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('bookmark_id', segments[2]);
      if (error) throw toApiError(error);
      return { message: 'Bookmark deleted' } as T;
    }

    // /api/admin/{table}/{id} — FK cascades handle chapters/verses/bookmarks
    const tableMap: Record<string, [string, string]> = {
      categories: ['categories', 'category_id'],
      books: ['books', 'book_id'],
      chapters: ['chapters', 'chapter_id'],
      verses: ['verses', 'verse_id'],
    };
    if (segments[1] === 'admin' && segments.length === 4) {
      const [table, idField] = tableMap[segments[2]] ?? [];
      if (table) {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq(idField, segments[3]);
        if (error) throw toApiError(error);
        return { message: 'Deleted' } as T;
      }
    }

    throw new ApiError(404, `Unknown endpoint: ${endpoint}`);
  }

  // -------------------------------------------------------------- helpers
  private async fromSelect(table: string, orderColumn: string): Promise<any> {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderColumn, { ascending: true });
    if (error) throw toApiError(error);
    return data;
  }

  private async single(table: string, idField: string, id: string): Promise<any> {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq(idField, id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') throw new ApiError(404, 'Not found');
      throw toApiError(error);
    }
    return data;
  }
}

export const apiClient = new ApiClient();
