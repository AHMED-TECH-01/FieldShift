import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
}

const DEFAULT_TITLE = 'FieldShift | AI-Powered Climate-Smart Agriculture';
const DEFAULT_DESCRIPTION =
  'Transform NASA Earth observation data into smarter farming decisions. FieldShift helps farmers analyze climate risks, compare crop rotations, and build resilient agricultural strategies.';
const DEFAULT_IMAGE = 'https://fieldshift.ag/images/og-share-card.jpg';
const BASE_URL = 'https://fieldshift.ag';

export const SEO: React.FC<SEOProps> = ({
  title,
  description,
  path = '/',
  image,
  noIndex = false,
}) => {
  useEffect(() => {
    // 1. Update Document Title
    const finalTitle = title ? `${title}` : DEFAULT_TITLE;
    document.title = finalTitle;

    // 2. Helper to set or create meta tags
    const setMetaTag = (attrName: 'name' | 'property', attrValue: string, content: string) => {
      let tag = document.querySelector(`meta[${attrName}="${attrValue}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attrName, attrValue);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    // 3. Update Standard Meta Tags
    const finalDesc = description || DEFAULT_DESCRIPTION;
    const finalImg = image || DEFAULT_IMAGE;
    const finalUrl = `${BASE_URL}${path === '/' ? '' : path}`;

    setMetaTag('name', 'description', finalDesc);
    setMetaTag('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');

    // 4. Update OpenGraph Tags
    setMetaTag('property', 'og:title', finalTitle);
    setMetaTag('property', 'og:description', finalDesc);
    setMetaTag('property', 'og:url', finalUrl);
    setMetaTag('property', 'og:image', finalImg);
    setMetaTag('property', 'og:type', 'website');
    setMetaTag('property', 'og:site_name', 'FieldShift');

    // 5. Update Twitter Tags
    setMetaTag('name', 'twitter:title', finalTitle);
    setMetaTag('name', 'twitter:description', finalDesc);
    setMetaTag('name', 'twitter:image', finalImg);
    setMetaTag('name', 'twitter:card', 'summary_large_image');

    // 6. Update Canonical Link
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', finalUrl);
  }, [title, description, path, image, noIndex]);

  return null;
};
