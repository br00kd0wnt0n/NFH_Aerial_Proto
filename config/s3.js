const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');

// Factory function to create S3 configuration
function createS3Config() {
    // Validate environment variables
    const requiredEnvVars = {
        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
        AWS_REGION: process.env.AWS_REGION,
        AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME
    };

    // Debug logging for environment variables
    console.log('S3 Configuration - Environment Variables:');
    console.log('AWS_ACCESS_KEY_ID:', requiredEnvVars.AWS_ACCESS_KEY_ID ? '[HIDDEN]' : 'not set');
    console.log('AWS_SECRET_ACCESS_KEY:', requiredEnvVars.AWS_SECRET_ACCESS_KEY ? '[HIDDEN]' : 'not set');
    console.log('AWS_REGION:', requiredEnvVars.AWS_REGION || 'not set');
    console.log('AWS_BUCKET_NAME:', requiredEnvVars.AWS_BUCKET_NAME || 'not set');

    // Check for missing environment variables
    const missingVars = Object.entries(requiredEnvVars)
        .filter(([_, value]) => !value)
        .map(([key]) => key);

    if (missingVars.length > 0) {
        const errorMsg = `Missing required environment variables: ${missingVars.join(', ')}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    // Configure AWS S3 client
    const s3Client = new S3Client({
        region: requiredEnvVars.AWS_REGION,
        credentials: {
            accessKeyId: requiredEnvVars.AWS_ACCESS_KEY_ID,
            secretAccessKey: requiredEnvVars.AWS_SECRET_ACCESS_KEY
        }
    });

    // Configure multer for S3 uploads
    const upload = multer({
        storage: multerS3({
            s3: s3Client,
            bucket: requiredEnvVars.AWS_BUCKET_NAME,
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

    return { s3Client, upload };
}

// Initialize S3 configuration
let s3Config;
try {
    s3Config = createS3Config();
    console.log('S3 configuration initialized successfully');
} catch (error) {
    console.error('Failed to initialize S3 configuration:', error);
    throw error;
}

module.exports = s3Config; 