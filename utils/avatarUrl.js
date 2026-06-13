const { buildMediaUrl } = require('./mediaUrl');

const buildAvatarUrl = (_req, filename) => buildMediaUrl(filename, 'avatars');

const avatarFilenameFromUrl = (avatarUrl) => {
  if (!avatarUrl) return null;
  if (!avatarUrl.startsWith('http')) return avatarUrl;
  const parts = avatarUrl.split('/');
  return parts[parts.length - 1] || null;
};

module.exports = { buildAvatarUrl, avatarFilenameFromUrl };
