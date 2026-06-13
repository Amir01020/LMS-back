const path = require('path');
const fs = require('fs');
const multer = require('multer');

const AVATAR_DIR = path.join(__dirname, '..', 'uploads', 'avatars');
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const userId = req.params.id || req.user?.userId || 'unknown';
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `user-${userId}-${Date.now()}${ext}`);
  }
});

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Допустимые форматы: JPEG, PNG, GIF, WEBP'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE }
});

const uploadAvatar = upload.single('avatar');

const handleUploadError = (err, req, res, next) => {
  if (!err) return next();
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'Файл слишком большой (макс. 5 МБ)' });
  }
  return res.status(400).json({ success: false, message: err.message });
};

module.exports = { uploadAvatar, handleUploadError, AVATAR_DIR };
