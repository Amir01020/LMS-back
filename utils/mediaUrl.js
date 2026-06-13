const getApiBase = () => {
  const base = process.env.API_BASE_URL || 'http://localhost:3000';
  return base.replace(/\/$/, '');
};

const buildMediaUrl = (filename, subdir) => {
  if (!filename) return null;
  if (filename.startsWith('http://') || filename.startsWith('https://')) {
    return filename;
  }
  const cleanName = filename.replace(/^\/+/, '');
  return `${getApiBase()}/uploads/${subdir}/${cleanName}`;
};

const normalizeMediaUrl = (url) => {
  if (!url) return null;
  if (!url.startsWith('http')) {
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${getApiBase()}${path}`;
  }

  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith('/uploads/')) {
      return `${getApiBase()}${parsed.pathname}`;
    }
  } catch {
    return url;
  }

  return url;
};

module.exports = { getApiBase, buildMediaUrl, normalizeMediaUrl };
