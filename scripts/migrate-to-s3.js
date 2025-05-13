const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const mongoose = require('mongoose');
require('dotenv').config();

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-2',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const Asset = require('../models/asset');

async function migrateToS3() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/netflix-house');
        console.log('Connected to MongoDB');

        // Get all assets
        const assets = await Asset.find({});
        console.log(`Found ${assets.length} assets to migrate`);

        for (const asset of assets) {
            console.log(`\nChecking asset: ${asset._id}`);
            console.log(`  Name: ${asset.name}`);
            console.log(`  Type: ${asset.type}`);
            console.log(`  URL: ${asset.url}`);
            // Skip if already using S3 URL
            if (asset.url.startsWith('https://')) {
                console.log(`  Skipping asset ${asset._id} - already using S3 URL`);
                continue;
            }

            // Try both possible paths for the file
            const localPaths = [
                path.join(__dirname, '..', asset.url), // Try absolute path
                path.join(__dirname, '..', 'public', asset.url) // Try public/uploads path
            ];
            console.log('  Trying local paths:', localPaths);

            let fileContent = null;
            let localPath = null;

            for (const p of localPaths) {
                if (fs.existsSync(p)) {
                    console.log(`  Found file at: ${p}`);
                    fileContent = fs.readFileSync(p);
                    localPath = p;
                    break;
                } else {
                    console.log(`  File does NOT exist at: ${p}`);
                }
            }

            if (!fileContent) {
                console.error(`  File not found for asset ${asset._id} at any of these paths:`, localPaths);
                continue;
            }

            // Update the key to use the NFH_Aerial_Assets folder
            const key = `uploads/NFH_Aerial_Assets/${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(asset.url)}`;
            console.log(`  Uploading to S3 with key: ${key}`);

            // Upload to S3
            await s3Client.send(new PutObjectCommand({
                Bucket: 'netflixaerialbucket',
                Key: key,
                Body: fileContent,
                ContentType: 'video/mp4'
            }));

            // Get the S3 URL using the correct bucket and region
            const s3Url = `https://netflixaerialbucket.s3.us-east-2.amazonaws.com/${key}`;
            console.log(`  S3 URL: ${s3Url}`);

            // Update asset in database
            asset.url = s3Url;
            await asset.save();
            console.log(`  Updated asset in DB: ${asset._id}`);

            // Delete local file
            fs.unlinkSync(localPath);
            console.log(`  Deleted local file: ${localPath}`);
        }

        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

migrateToS3(); 