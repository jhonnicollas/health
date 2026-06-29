export interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  publishedTime?: string;
  modifiedTime?: string;
}

export const SITE_NAME = "iSehat";
export const SITE_URL = "https://isehat.biz.id";
export const DEFAULT_OG_IMAGE = "/images/og-default.png";

export function buildSEO(props: SEOProps) {
  const canonical = props.canonical || SITE_URL;
  const ogImage = props.ogImage ? `${SITE_URL}${props.ogImage}` : `${SITE_URL}${DEFAULT_OG_IMAGE}`;
  return {
    title: `${props.title} | ${SITE_NAME}`,
    description: props.description,
    canonical,
    ogImage,
    ogType: props.ogType || "website",
    publishedTime: props.publishedTime,
    modifiedTime: props.modifiedTime,
  };
}
