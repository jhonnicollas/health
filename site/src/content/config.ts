import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishedAt: z.string(),
    updatedAt: z.string(),
    category: z.string(),
    tags: z.array(z.string()),
    author: z.string(),
    reviewedBy: z.string().optional(),
    reviewStatus: z.enum(["editorial", "reviewed"]).optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    coverImage: z.string().default("/images/blog/default.webp"),
    seoTitle: z.string(),
    seoDescription: z.string(),
    references: z.array(z.object({
      label: z.string(),
      url: z.string(),
    })).default([]),
  }),
});

export const collections = { blog };
