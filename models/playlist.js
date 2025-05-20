const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema({
    houseId: {
        type: Number,
        required: true,
        index: true
    },
    hotspots: {
        type: Map,
        of: {
            diveIn: {
                videoId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Asset'
                }
            },
            floorLevel: {
                videoId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Asset'
                }
            },
            zoomOut: {
                videoId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Asset'
                }
            }
        },
        default: new Map()
    }
}, {
    timestamps: true
});

// Create a compound index on houseId to ensure uniqueness
playlistSchema.index({ houseId: 1 }, { unique: true });

module.exports = mongoose.model('Playlist', playlistSchema); 