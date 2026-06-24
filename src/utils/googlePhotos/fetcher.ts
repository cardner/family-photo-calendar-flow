// Album fetching utilities routed through the Cloudflare Worker proxy.

import { extractAlbumIdFromUrl } from './urlExtractor';
import { extractImagesFromHtml } from './imageExtractor';
import { buildWorkerProxyUrl, hasWorkerBase } from '@/utils/workerProxy';

export const fetchAlbumImages = async (albumUrl: string): Promise<string[]> => {
  if (!hasWorkerBase()) {
    throw new Error(
      'Google Photos proxy is not configured. Set VITE_WORKER_BASE to your Cloudflare Worker URL.',
    );
  }

  // Shortened goo.gl links are resolved by the Worker (it follows redirects),
  // so album-id validation is only enforced for full share URLs.
  const isShortened = albumUrl.includes('photos.app.goo.gl');
  const albumId = extractAlbumIdFromUrl(albumUrl);
  if (!albumId && !isShortened) {
    console.error('🖼️ Failed to extract album ID from URL:', albumUrl);
    throw new Error('Invalid Google Photos album URL format - could not extract album ID');
  }

  const proxyUrl = buildWorkerProxyUrl('photos', albumUrl);

  let response: Response;
  try {
    response = await fetch(proxyUrl, {
      method: 'GET',
      headers: { 'Accept': 'text/html, */*' },
    });
  } catch (error) {
    throw new Error(
      'Unable to reach the photos proxy. Please check your connection and try again later.',
    );
  }

  if (!response.ok) {
    throw new Error(
      `Unable to access the Google Photos album (status ${response.status}). ` +
        'Ensure the album is publicly shared.',
    );
  }

  const html = await response.text();
  if (html.length < 1000) {
    throw new Error('Google Photos returned insufficient content for this album.');
  }

  const images = extractImagesFromHtml(html);
  if (images.length === 0) {
    throw new Error(
      'No images found in the Google Photos album. This could be due to:\n' +
        '• The album is private or sharing is disabled\n' +
        '• The album contains no photos\n\n' +
        'Please ensure the album is publicly accessible and try again.',
    );
  }

  return images;
};
