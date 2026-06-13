const { buildMediaUrl } = require('./mediaUrl');

const buildShopImageUrl = (_req, filename) => buildMediaUrl(filename, 'shop');

const shopImageFilenameFromUrl = (imageUrl) => {
  if (!imageUrl) return null;
  if (!imageUrl.startsWith('http')) return imageUrl;
  const parts = imageUrl.split('/');
  return parts[parts.length - 1] || null;
};

module.exports = { buildShopImageUrl, shopImageFilenameFromUrl };
