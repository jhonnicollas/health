import { getCollection } from "astro:content";

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  category: string;
  tags: string[];
  author: string;
  featured: boolean;
  draft: boolean;
  coverImage: string;
}

export async function getPublishedPosts() {
  const posts = await getCollection("blog", ({ data }) => !data.draft);
  return posts.sort(
    (a, b) => new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime()
  );
}

export function getCategories(posts: { data: { category: string } }[]): string[] {
  return [...new Set(posts.map((p) => p.data.category))].sort();
}
