const mongoose = require('mongoose');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
require('dotenv').config();

const Asset = require('../models/asset');

const s3Client = new S3Client({
    region: 'us-east-2',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

async function importS3Assets() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/netflix-house');
        console.log('Connected to MongoDB');

        // List all objects in the NFH_Aerial_Assets folder
        const listCommand = new ListObjectsV2Command({
            Bucket: 'netflixaerialbucket',
            Prefix: 'uploads/NFH_Aerial_Assets/'
        });

        const { Contents } = await s3Client.send(listCommand);
        
        if (!Contents || Contents.length === 0) {
            console.log('No files found in S3 bucket');
            return;
        }

        console.log(`Found ${Contents.length} files in S3 bucket`);

        // Process each file
        for (const object of Contents) {
            const key = object.Key;
            const filename = key.split('/').pop();
            const s3Url = `https://netflixaerialbucket.s3.us-east-2.amazonaws.com/${key}`;

            // Skip if not a video file
            if (!filename.match(/\.(mp4|mov|avi|wmv)$/i)) {
                console.log(`Skipping non-video file: ${filename}`);
                continue;
            }

            // Determine asset type from filename
            let type = 'aerial'; // default type
            const filenameLower = filename.toLowerCase();
            
            if (filenameLower.includes('dive')) {
                type = 'diveIn';
            } else if (filenameLower.includes('floor')) {
                type = 'floorLevel';
            } else if (filenameLower.includes('zoom')) {
                type = 'zoomOut';
            }

            // Determine house ID from filename (you may need to adjust this logic)
            let houseId = 1; // default to KOP
            if (filenameLower.includes('dallas')) {
                houseId = 2;
            }

            // Check if asset already exists in database
            const existingAsset = await Asset.findOne({ url: s3Url });
            if (existingAsset) {
                console.log(`Asset already exists in database: ${filename}`);
                continue;
            }

            // Create new asset
            const asset = new Asset({
                name: filename,
                type: type,
                url: s3Url,
                houseId: houseId,
                playbackRules: {
                    loop: type === 'aerial',
                    autoplay: true,
                    muted: true
                }
            });

            await asset.save();
            console.log(`Added asset to database: ${filename} (${type}) for house ${houseId}`);
        }

        console.log('Import completed successfully');
    } catch (error) {
        console.error('Import failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

importS3Assets(); 