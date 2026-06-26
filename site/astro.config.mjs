import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: "https://isehat.biz.id",
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes("/drafts/")
    }),
    tailwind({
      applyBaseStyles: false
    })
  ],
  markdown: {
    shikiConfig: {
      theme: "github-light"
    }
  }
});
