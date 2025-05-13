const mongoose = require('mongoose');
const { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const Asset = require('../models/asset');

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-2',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

async function migrateAdminUploads() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/netflix-house');
        console.log('Connected to MongoDB');

        // List all objects in the uploads folder (excluding NFH_Aerial_Assets)
        const listCommand = new ListObjectsV2Command({
            Bucket: 'netflixaerialbucket',
            Prefix: 'uploads/'
        });

        const { Contents } = await s3Client.send(listCommand);
        
        if (!Contents || Contents.length === 0) {
            console.log('No files found in S3 bucket');
            return;
        }

        // Filter out files that are already in NFH_Aerial_Assets
        const filesToMigrate = Contents.filter(obj => 
            obj.Key.startsWith('uploads/') && 
            !obj.Key.startsWith('uploads/NFH_Aerial_Assets/') &&
            obj.Key.match(/\.(mp4|mov|avi|wmv)$/i)
        );

        console.log(`Found ${filesToMigrate.length} files to migrate`);

        // Process each file
        for (const object of filesToMigrate) {
            const oldKey = object.Key;
            const filename = oldKey.split('/').pop();
            const newKey = `uploads/NFH_Aerial_Assets/${filename}`;
            
            console.log(`\nProcessing file: ${oldKey}`);
            console.log(`New location: ${newKey}`);

            try {
                // Copy the file to the new location
                await s3Client.send(new CopyObjectCommand({
                    Bucket: 'netflixaerialbucket',
                    CopySource: `netflixaerialbucket/${oldKey}`,
                    Key: newKey
                }));
                console.log('File copied successfully');

                // Update the asset URL in the database
                const oldUrl = `https://netflixaerialbucket.s3.us-east-2.amazonaws.com/${oldKey}`;
                const newUrl = `https://netflixaerialbucket.s3.us-east-2.amazonaws.com/${newKey}`;
                
                const asset = await Asset.findOne({ url: oldUrl });
                if (asset) {
                    asset.url = newUrl;
                    await asset.save();
                    console.log('Updated asset URL in database');

                    // Delete the old file
                    await s3Client.send(new DeleteObjectCommand({
                        Bucket: 'netflixaerialbucket',
                        Key: oldKey
                    }));
                    console.log('Deleted old file');
                } else {
                    console.log('No matching asset found in database');
                }
            } catch (error) {
                console.error(`Error processing file ${oldKey}:`, error);
            }
        }

        console.log('\nMigration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

migrateAdminUploads(); 