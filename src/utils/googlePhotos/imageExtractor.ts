// Image extraction utilities for Google Photos HTML content

export const extractImagesFromHtml = (html: string): string[] => {
  // Extract image URLs from the HTML
  // Google Photos uses specific patterns for image URLs
  const imageUrlPatterns = [
    /https:\/\/lh\d+\.googleusercontent\.com\/[^"'\s\]]+/g,
    /"(https:\/\/lh\d+\.googleusercontent\.com\/[^"]+)"/g,
    /'(https:\/\/lh\d+\.googleusercontent\.com\/[^']+)'/g
  ];
  
  const foundUrls = new Set<string>();
  
  for (const pattern of imageUrlPatterns) {
    const matches = html.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // Clean up the URL (remove quotes if present)
        const cleanUrl = match.replace(/['"]/g, '');
        
        // Filter out profile photos and small images
        if (isValidAlbumPhoto(cleanUrl, html)) {
          // Get the base URL without size parameters
          let baseUrl = cleanUrl.split('=')[0];
          
          // Ensure we get the original, full-size image
          // Remove any existing size parameters and add parameters for original size
          if (!baseUrl.includes('=')) {
            // For original size without any resizing: use =s0
            baseUrl += '=s0';
          }
          
          foundUrls.add(baseUrl);
        }
      });
    }
  }
  
  // Try alternative extraction methods if no images found
  if (foundUrls.size === 0) {
    tryAlternativeExtraction(html, foundUrls);
  }
  
  const finalImageUrls = Array.from(foundUrls);
  
  // Return ALL images instead of limiting to 50
  return finalImageUrls;
};

const isValidAlbumPhoto = (url: string, html: string): boolean => {
  // Basic URL validation
  if (!url.includes('googleusercontent.com') || url.length < 60) {
    return false;
  }
  
  // Filter out common profile photo and UI element patterns
  const profilePhotoPatterns = [
    /=s40/, /=s32/, /=s64/, /=s96/, /=s128/, /=s160/, /=s200/, /=s240/, /=s280/, /=s320/, // Small to medium sizes typically used for profile photos
    /\/avatar\//, /-rp-/, /_rp\./, /profile/, /face/, /contact/,
    /=c-/, // Cropped images (often profile photos)
    /=p-/, // Profile photo indicator
    /\/photo\.jpg/, // Generic photo names often used for profiles
    /user_/, /account_/, /member_/, // User-related identifiers
    /=cc/, // Circular crop indicator (common for profile photos)
    /=fh/, // Face highlight crop
    /=fc/, // Face crop
    /=rj/, // Round/circular crop (profile photos)
    /=sc/, // Square crop (often profile photos)
    /=rw/, // Round width crop
    /=rh/, // Round height crop
    /-c$/, /-cropped/, // Cropped image indicators
    /=w\d+-h\d+-p-k-no-nu/, // Google's profile photo URL pattern
    /circular/, /round/, /square/ // Shape-based indicators
  ];
  
  for (const pattern of profilePhotoPatterns) {
    if (pattern.test(url)) {
      return false;
    }
  }
  
  // Check the HTML context where this URL appears
  const urlIndex = html.indexOf(url);
  if (urlIndex !== -1) {
    // Get surrounding HTML context (500 chars before and after)
    const start = Math.max(0, urlIndex - 500);
    const end = Math.min(html.length, urlIndex + url.length + 500);
    const context = html.substring(start, end).toLowerCase();
    
    // Check for profile-related HTML context
    const profileContextPatterns = [
      'data-profile', 'profile-photo', 'user-avatar', 'owner-photo',
      'header-avatar', 'account-photo', 'member-photo', 'contributor',
      'aria-label="profile"', 'class="profile', 'id="profile',
      'data-testid="profile', 'role="img".*profile', 'alt="profile',
      'profile-image', 'profile-pic', 'user-photo', 'avatar-image',
      'circular', 'round-image', 'face-crop', 'initials',
      'letter-avatar', 'monogram', 'user-initial', 'profile-circle',
      'account-avatar', 'user-badge', 'profile-badge'
    ];
    
    for (const contextPattern of profileContextPatterns) {
      if (context.includes(contextPattern)) {
        return false;
      }
    }
    
    // Additional check: if URL appears in header section or navigation
    const headerSectionPatterns = [
      '<header', '</header>', 'class="header', 'id="header',
      'class="nav', 'id="nav', 'class="toolbar', 'class="topbar'
    ];
    
    for (const headerPattern of headerSectionPatterns) {
      const headerIndex = context.indexOf(headerPattern);
      if (headerIndex !== -1 && Math.abs(headerIndex - 250) < 200) { // Within 200 chars of our URL position in context
        return false;
      }
    }
  }
  
  // Enhanced size-based filtering for profile photos
  const sizeMatch = url.match(/=s(\d+)/);
  if (sizeMatch) {
    const size = parseInt(sizeMatch[1]);
    // Profile photos are often small to medium sized (up to 400px)
    if (size < 400) {
      return false;
    }
  }
  
  // Check for square dimensions which are common for profile photos
  const squareDimensionMatch = url.match(/=w(\d+)-h(\d+)/);
  if (squareDimensionMatch) {
    const width = parseInt(squareDimensionMatch[1]);
    const height = parseInt(squareDimensionMatch[2]);
    // Square images under 400px are likely profile photos
    if (width === height && width < 400) {
      return false;
    }
    // Very small rectangular images are also likely profile elements
    if (width < 300 || height < 300) {
      return false;
    }
  }
  
  // Check for metadata, thumbnail, and profile photo indicators in the URL
  const metadataPatterns = [
    /\/metadata\//, /\/thumb\//, /\/thumbnail\//, /\/preview\//,
    /=w\d+-h\d+-/, // Specific width-height combinations often used for thumbnails
    /=pp-/, // Thumbnail indicator
    /=mv-/, // Movie/video thumbnail
    /=no-/, // No-crop indicator (sometimes used for profile photos)
    /=fv/, // Face view indicator
    /=ci/, // Circle indicator (profile photos)
    /=mo/, // Monogram/initial indicator
    /=ft/, // Face thumbnail
    /=at/, // Avatar thumbnail
    /=profile/, // Direct profile indicator
    /=icon/, // Icon-sized images
    /=badge/, // Badge-style images (often profile related)
  ];
  
  for (const pattern of metadataPatterns) {
    if (pattern.test(url)) {
      return false;
    }
  }
  
  return true;
};

const tryAlternativeExtraction = (html: string, foundUrls: Set<string>): void => {
  const altPatterns = [
    /"(https:\/\/lh\d+\.googleusercontent\.com[^"]*?)"/g,
    /https:\/\/lh\d+\.googleusercontent\.com\/[^\s"'<>\]]+/g,
    /\bhttps:\/\/lh\d+\.googleusercontent\.com\/[A-Za-z0-9\-_]+/g
  ];
  
  for (const altPattern of altPatterns) {
    const altMatches = html.match(altPattern);
    if (altMatches) {
      altMatches.forEach(match => {
        const cleanUrl = match.replace(/['"]/g, '');
        
        // Apply same validation for alternative patterns
        if (isValidAlbumPhoto(cleanUrl, html)) {
          const baseUrl = cleanUrl.split('=')[0] + '=s0';
          foundUrls.add(baseUrl);
        }
      });
    }
  }
};
