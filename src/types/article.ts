export interface Article {
  id: number;
  title: string;
  content: string;
  category: string;
  source_url: string | null;
  image_url: string | null;
  seo_description: string | null;
  created_at: string;
}

export type ArticleSummary = Pick<
  Article,
  'id' | 'title' | 'category' | 'image_url' | 'seo_description' | 'created_at' | 'source_url'
>;
