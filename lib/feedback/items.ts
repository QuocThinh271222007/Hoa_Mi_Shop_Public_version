// Truncate to at most `maxWords` words (used for the short reviewer description).
export function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(' ');
}

export interface FeedbackItem {
  id: string;
  name: string;
  text: string;
  image_url?: string | null;
  rating?: number | null;
  description?: string | null;
  detail_title?: string | null;
  detail_title_font_size?: number | null;
  reviewer_font_size?: number | null;
}

// Static fallback (matches current hardcoded FeedbackClient data)
export const MOCK_FEEDBACK: FeedbackItem[] = [
  { id: 'f1', name: 'Hồng Ngọc',   text: 'Nguyện PR cho sốp mãi luôn, dây xinh ngoài mong đợi luôn' },
  { id: 'f2', name: 'Minh Châu',   text: 'Đồ Cúc xinh xiu quá trời, mặc vào tự tin hơn liền!' },
  { id: 'f3', name: 'Thanh Tuyền', text: 'Chất vải tốt lắm ạ, mặc mát mà lại đẹp!' },
  { id: 'f4', name: 'Ngọc Anh',    text: 'Order lần 2 rồi, lần nào cũng ưng hết sức luôn ♡' },
  { id: 'f5', name: 'Bảo Ngọc',    text: 'Ship nhanh, đóng gói cẩn thận, áo y hệt ảnh!' },
];

const FEEDBACK_BASE_FIELDS =
  'id, customer_name, message, image_url, rating, description, detail_title, detail_title_font_size';
const FEEDBACK_FIELDS = `${FEEDBACK_BASE_FIELDS}, reviewer_font_size`;

export async function getFeedbackItems(): Promise<FeedbackItem[]> {
  try {
    const { createSupabaseServerClient } = await import('../supabase/server-client');
    const db = await createSupabaseServerClient();
    const run = (fields: string) =>
      db
        .from('feedback_items')
        .select(fields)
        .eq('is_published', true)
        .order('sort_order')
        .order('created_at', { ascending: false });
    // Try with the new column; if the migration isn't applied yet, retry without it.
    let { data, error } = await run(FEEDBACK_FIELDS);
    if (error) ({ data, error } = await run(FEEDBACK_BASE_FIELDS));
    if (error || !data || data.length === 0) return MOCK_FEEDBACK;
    return (data as unknown as {
      id: string;
      customer_name: string;
      message: string;
      image_url: string | null;
      rating: number | null;
      description: string | null;
      detail_title: string | null;
      detail_title_font_size: number | null;
      reviewer_font_size?: number | null;
    }[]).map((row) => ({
      id: row.id,
      name: row.customer_name,
      text: row.message,
      image_url: row.image_url,
      rating: row.rating,
      description: row.description,
      detail_title: row.detail_title,
      detail_title_font_size: row.detail_title_font_size,
      reviewer_font_size: row.reviewer_font_size ?? null,
    }));
  } catch {
    return MOCK_FEEDBACK;
  }
}
