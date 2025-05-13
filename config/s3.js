const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');

// Debug logging for environment variables
console.log('AWS Configuration:');
console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '[HIDDEN]' : 'not set');
console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '[HIDDEN]' : 'not set');
console.log('AWS_REGION:', process.env.AWS_REGION || 'not set');
console.log('AWS_BUCKET_NAME:', process.env.AWS_BUCKET_NAME || 'not set');

// Configure AWS S3 client
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// Configure multer for S3 uploads
const upload = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: process.env.AWS_BUCKET_NAME,
        metadata: function (req, file, cb) {
            cb(null, { fieldName: file.fieldname });
        },
        key: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, `uploads/NFH_Aerial_Assets/${uniqueSuffix}${path.extname(file.originalname)}`);
        }
    }),
    fileFilter: function (req, file, cb) {
        if (!file.mimetype.startsWith('video/')) {
            return cb(new Error('Only video files are allowed!'), false);
        }
        cb(null, true);
    },
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    }
});

module.exports = { s3Client, upload }; 