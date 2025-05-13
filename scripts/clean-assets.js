const mongoose = require('mongoose');
const { S3Client, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
require('dotenv').config();

const Asset = require('../models/asset');

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

async function cleanAssets() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/netflix-house');
        console.log('Connected to MongoDB');

        // Get all assets from MongoDB
        const assets = await Asset.find({});
        console.log(`Found ${assets.length} assets in database`);

        // Delete assets from S3 and MongoDB
        let deletedCount = 0;
        let s3ErrorCount = 0;
        let dbErrorCount = 0;

        for (const asset of assets) {
            try {
                // Extract S3 key from URL
                const s3Url = new URL(asset.url);
                const key = s3Url.pathname.slice(1); // Remove leading slash

                // Delete from S3
                try {
                    await s3Client.send(new DeleteObjectCommand({
                        Bucket: process.env.AWS_BUCKET_NAME,
                        Key: key
                    }));
                    console.log(`Deleted from S3: ${key}`);
                } catch (s3Error) {
                    console.warn(`Failed to delete from S3: ${key}`, s3Error);
                    s3ErrorCount++;
                }

                // Delete from MongoDB
                await Asset.findByIdAndDelete(asset._id);
                console.log(`Deleted from MongoDB: ${asset._id}`);
                deletedCount++;
            } catch (error) {
                console.error(`Error processing asset ${asset._id}:`, error);
                dbErrorCount++;
            }
        }

        // List any remaining objects in S3 bucket
        try {
            const listCommand = new ListObjectsV2Command({
                Bucket: process.env.AWS_BUCKET_NAME,
                Prefix: 'uploads/'
            });
            const { Contents } = await s3Client.send(listCommand);
            
            if (Contents && Contents.length > 0) {
                console.log('\nRemaining objects in S3 bucket:');
                Contents.forEach(obj => console.log(`- ${obj.Key}`));
            } else {
                console.log('\nNo remaining objects in S3 bucket');
            }
        } catch (error) {
            console.error('Error listing S3 bucket contents:', error);
        }

        console.log('\nCleanup summary:');
        console.log(`- Successfully deleted ${deletedCount} assets from both S3 and MongoDB`);
        console.log(`- Failed to delete ${s3ErrorCount} assets from S3`);
        console.log(`- Failed to delete ${dbErrorCount} assets from MongoDB`);

        console.log('\nDatabase cleanup completed');
    } catch (error) {
        console.error('Cleanup failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

cleanAssets(); 