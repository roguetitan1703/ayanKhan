import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Use import.meta.url to get the directory of the current module (i.e., upload.js)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directory where files will be uploaded
const uploadDir = path.join(__dirname, '../public/uploads');

// Ensure the directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // Set destination folder
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`); // Set filename
  }
});

// Initialize multer with the storage configuration
const upload = multer({ storage: storage });

// Export the upload function
export { upload };