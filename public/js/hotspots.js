class HotspotManager {
    constructor() {
        console.log('Initializing HotspotManager');
        this.hotspotContainer = document.querySelector('#hotspotContainer');
        console.log('Hotspot container:', this.hotspotContainer);
        this.hotspots = [];
        this.currentHouse = 1;
        this.currentHotspot = null;
        
        // DOM Elements
        this.houseSelector = document.getElementById('houseSelector');
        this.aerialView = document.getElementById('aerialView');
        this.transitionView = document.getElementById('transitionView');
        this.floorLevelView = document.getElementById('floorLevelView');
        this.backButton = document.querySelector('.back-button');
        this.stateIndicator = document.getElementById('stateIndicator');
        this.updateButton = document.getElementById('updateButton');
        
        console.log('DOM Elements:', {
            houseSelector: this.houseSelector,
            aerialView: this.aerialView,
            transitionView: this.transitionView,
            floorLevelView: this.floorLevelView,
            backButton: this.backButton,
            stateIndicator: this.stateIndicator,
            updateButton: this.updateButton
        });
        
        // Initialize views
        this.initializeViews();
        
        // Video Elements
        this.aerialVideo = document.getElementById('aerialVideo');
        this.transitionVideo = document.getElementById('transitionVideo');
        this.floorLevelVideo = document.getElementById('floorLevelVideo');
        
        // Add playback clock elements
        this.playbackClocks = new Map();
        
        // Initialize
        this.initializeEventListeners();
        this.loadHotspots();
        this.loadAssets();
    }
    
    initializeViews() {
        // Set up aerial view
        this.aerialView.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: black;
            z-index: 1;
        `;

        // Set up transition view
        this.transitionView.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: black;
            z-index: 2;
            display: none;
        `;

        // Set up floor level view
        this.floorLevelView.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: black;
            z-index: 3;
            display: none;
        `;

        // Create video containers
        const createVideoContainer = (view) => {
            // Remove any existing containers
            const existingContainer = view.querySelector('.video-container');
            if (existingContainer) {
                existingContainer.remove();
            }

            const container = document.createElement('div');
            container.className = 'video-container';
            container.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: black;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            view.appendChild(container);

            const placeholder = document.createElement('div');
            placeholder.className = 'video-placeholder';
            placeholder.style.cssText = `
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            container.appendChild(placeholder);
        };

        createVideoContainer(this.transitionView);
        createVideoContainer(this.floorLevelView);

        // Ensure state indicator and asset label are always visible
        if (this.stateIndicator) {
            this.stateIndicator.style.display = 'block';
            this.stateIndicator.style.zIndex = '2000';
        }
    }
    
    initializeEventListeners() {
        // House selection
        if (this.houseSelector) {
            this.houseSelector.addEventListener('change', (e) => {
                this.currentHouse = parseInt(e.target.value);
                this.loadHotspots();
            });
        }
        
        // Back button
        if (this.backButton) {
            this.backButton.addEventListener('click', () => this.handleBackToAerial());
        }
        
        // Video end events
        if (this.transitionVideo) {
            this.transitionVideo.addEventListener('ended', () => this.handleVideoEnd());
        }
        if (this.floorLevelVideo) {
            this.floorLevelVideo.addEventListener('ended', () => this.handleVideoEnd());
        }
        
        // Listen for reload events
        if (window) {
            window.addEventListener('focus', () => this.checkForUpdates());
        }

        // Add click handler for update button
        if (this.updateButton) {
            this.updateButton.addEventListener('click', () => this.refreshAllData());
            this.updateButton.onmouseover = () => this.updateButton.style.opacity = '0.8';
            this.updateButton.onmouseout = () => this.updateButton.style.opacity = '1';
        }
    }
    
    async checkForUpdates() {
        try {
            const response = await fetch(`/api/hotspots?houseId=${this.currentHouse}&checkUpdate=true`);
            if (!response.ok) throw new Error('Failed to check for updates');
            
            const data = await response.json();
            if (data.needsUpdate) {
                await this.reload();
            }
        } catch (error) {
            console.error('Error checking for updates:', error);
        }
    }
    
    async reload() {
        try {
            // Clear existing data
            this.hotspots = [];
            this.hotspotAssets = [];
            
            // Reload hotspots and assets
            await this.loadHotspots();
            await this.loadAssets();
            
            // Reset views
            this.aerialView.style.display = 'block';
            this.transitionView.style.display = 'none';
            this.floorLevelView.style.display = 'none';
            
            // Update state
            this.stateIndicator.textContent = 'Current State: Aerial View';
        } catch (error) {
            console.error('Error reloading:', error);
        }
    }
    
    async loadHotspots() {
        try {
            console.log('Loading hotspots for house:', this.currentHouse);
            const response = await fetch(`/api/hotspots?houseId=${this.currentHouse}`);
            if (!response.ok) {
                throw new Error('Failed to load hotspots');
            }
            
            const data = await response.json();
            console.log('Received hotspot data:', data);
            
            if (!data || !data.hotspots) {
                throw new Error('Invalid response format');
            }
            
            this.hotspots = data.hotspots;
            console.log('Set hotspots array:', this.hotspots);
            this.renderHotspots();
        } catch (error) {
            console.error('Error loading hotspots:', error);
        }
    }
    
    async loadAssets() {
        try {
            const response = await fetch(`/api/assets?houseId=${this.currentHouse}`);
            if (!response.ok) throw new Error('Failed to load assets');
            
            const data = await response.json();
            const assets = data.assets;
            console.log('Loaded assets:', assets);
            
            // Get playlists to map videos to hotspots
            const playlistResponse = await fetch(`/api/playlists?houseId=${this.currentHouse}`);
            if (!playlistResponse.ok) throw new Error('Failed to load playlists');
            const playlistData = await playlistResponse.json();
            const playlists = playlistData.playlists;
            console.log('Loaded playlists:', playlists);
            
            // Load aerial video from global playlist
            const globalPlaylist = playlists.global || {};
            if (globalPlaylist.aerial && globalPlaylist.aerial.videoId) {
                const aerialAsset = assets.find(a => a._id === globalPlaylist.aerial.videoId);
                if (aerialAsset) {
                    // Get the aerial video element
                    const aerialVideo = document.getElementById('aerialVideo');
                    if (!aerialVideo) {
                        console.error('Aerial video element not found');
                        return;
                    }

                    // Set video properties
                    aerialVideo.src = aerialAsset.url;
                    aerialVideo.loop = true;
                    aerialVideo.autoplay = true;
                    aerialVideo.muted = true;
                    aerialVideo.playsInline = true;
                    aerialVideo.preload = 'auto';

                    // Add event listeners for video loading
                    aerialVideo.addEventListener('loadedmetadata', () => {
                        console.log('Aerial video metadata loaded:', {
                            width: aerialVideo.videoWidth,
                            height: aerialVideo.videoHeight
                        });
                        this.renderHotspots(); // Re-render hotspots with correct dimensions
                    });

                    aerialVideo.addEventListener('error', (e) => {
                        console.error('Error loading aerial video:', e);
                    });

                    // Load the video
                    await aerialVideo.load();
                    console.log('Loaded aerial video from playlist:', aerialAsset.url);
                    
                    // Add asset label for aerial video
                    const videoContainer = this.aerialView.querySelector('.video-container');
                    const existingLabel = videoContainer.querySelector('.asset-label');
                    if (existingLabel) {
                        existingLabel.remove();
                    }
                    const label = document.createElement('div');
                    label.className = 'asset-label';
                    label.textContent = `Aerial Video: ${aerialAsset.name || 'Unnamed'}`;
                    videoContainer.appendChild(label);

                    // Add playback clock for aerial video
                    const existingClock = videoContainer.querySelector('.playback-clock');
                    if (existingClock) {
                        existingClock.remove();
                    }
                    const clock = this.createPlaybackClock(videoContainer);
                    this.updatePlaybackClock(aerialVideo, clock);
                    this.playbackClocks.set('aerial', clock);
                } else {
                    console.log('Aerial video from playlist not found in assets');
                }
            } else {
                console.log('No aerial video assigned in global playlist');
            }
            
            // Log video assignments for each hotspot
            for (const [hotspotId, playlist] of Object.entries(playlists)) {
                if (hotspotId === 'global') continue; // Skip global playlist
                
                const hotspot = this.hotspots.find(h => h._id === hotspotId);
                const hotspotTitle = hotspot ? hotspot.title : 'Unknown';
                
                if (playlist.diveIn && playlist.diveIn.videoId) {
                    const diveInAsset = assets.find(a => a._id === playlist.diveIn.videoId);
                    console.log(`Dive-in video assigned for ${hotspotTitle}:`, diveInAsset ? diveInAsset.url : 'Not found');
                } else {
                    console.log(`No dive-in video assigned for ${hotspotTitle}`);
                }
                
                if (playlist.floorLevel && playlist.floorLevel.videoId) {
                    const floorLevelAsset = assets.find(a => a._id === playlist.floorLevel.videoId);
                    console.log(`Floor level video assigned for ${hotspotTitle}:`, floorLevelAsset ? floorLevelAsset.url : 'Not found');
                } else {
                    console.log(`No floor level video assigned for ${hotspotTitle}`);
                }
            }
        } catch (error) {
            console.error('Error loading assets:', error);
        }
    }
    
    renderHotspots() {
        // Clear existing hotspots
        const container = document.querySelector('.hotspot-container');
        container.innerHTML = '';
        
        // Get the aerial video element
        const aerialVideo = document.getElementById('aerialVideo');
        const videoWidth = 1920;  // Fixed width for 16:9 aspect ratio
        const videoHeight = 1080; // Fixed height for 16:9 aspect ratio
        
        // Get the container dimensions
        const containerRect = container.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        
        // Calculate the scale factor to maintain aspect ratio
        const scaleX = containerWidth / videoWidth;
        const scaleY = containerHeight / videoHeight;
        const scale = Math.min(scaleX, scaleY);
        
        // Calculate the centered position
        const scaledWidth = videoWidth * scale;
        const scaledHeight = videoHeight * scale;
        const offsetX = (containerWidth - scaledWidth) / 2;
        const offsetY = (containerHeight - scaledHeight) / 2;
        
        console.log('Container dimensions:', {
            containerWidth,
            containerHeight,
            videoWidth,
            videoHeight,
            scale,
            scaledWidth,
            scaledHeight,
            offsetX,
            offsetY
        });
        
        // Create SVG container with 16:9 aspect ratio viewBox
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('viewBox', '0 0 1920 1080'); // Match video dimensions exactly
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'all';
        svg.style.zIndex = '1000';
        
        // Add polygons for each hotspot
        this.hotspots.forEach(hotspot => {
            console.log('Creating polygon for hotspot:', JSON.stringify(hotspot, null, 2));
            
            if (!hotspot.points || !Array.isArray(hotspot.points) || hotspot.points.length < 3) {
                console.error('Invalid points data for hotspot:', JSON.stringify(hotspot, null, 2));
                return;
            }
            
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.setAttribute('class', 'hotspot');
            group.setAttribute('data-id', hotspot._id);
            group.style.pointerEvents = 'all';
            group.style.cursor = 'pointer';
            group.style.transform = 'none';
            group.style.transition = 'none';
            
            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            
            // Convert percentage coordinates to actual pixel coordinates
            const pointsString = hotspot.points.map(p => {
                const x = (p.x / 100) * videoWidth;
                const y = (p.y / 100) * videoHeight;
                return `${x},${y}`;
            }).join(' ');
            
            console.log('Setting polygon points:', pointsString);
            
            // Set points attribute
            polygon.setAttribute('points', pointsString);
            
            // Verify points were set
            const points = polygon.getAttribute('points');
            console.log('Verified polygon points:', points);
            
            if (!points || !points.trim()) {
                console.error('Failed to set points on polygon');
                return;
            }
            
            // Set default styles using SVG attributes
            polygon.setAttribute('fill', 'rgba(229, 9, 20, 0.2)'); // Semi-transparent fill
            polygon.setAttribute('stroke', hotspot.type === 'primary' ? '#e50914' : '#ff4d4d'); // Visible stroke
            polygon.setAttribute('stroke-width', '0.5');
            polygon.setAttribute('stroke-dasharray', '2,2');
            polygon.setAttribute('stroke-linecap', 'round');
            polygon.setAttribute('stroke-linejoin', 'round');
            polygon.style.transition = 'fill 0.2s ease, stroke 0.2s ease';
            
            // Add hover effect - show fill and stroke on hover
            group.addEventListener('mouseover', function() {
                polygon.setAttribute('fill', 'rgba(229, 9, 20, 0.4)');
                polygon.setAttribute('stroke-width', '1');
            });
            
            group.addEventListener('mouseout', function() {
                polygon.setAttribute('fill', 'rgba(229, 9, 20, 0.2)');
                polygon.setAttribute('stroke-width', '0.5');
            });
            
            // Add click handler
            group.addEventListener('click', () => this.handleHotspotClick(hotspot));
            
            group.appendChild(polygon);
            svg.appendChild(group);
        });
        
        container.appendChild(svg);
        
        // Log the final SVG structure
        console.log('Final SVG structure:', svg.innerHTML);
    }
    
    calculatePolygonCenter(points) {
        if (!points || points.length === 0) {
            return { x: 0, y: 0 };
        }

        // Ensure all points have valid numeric values
        const validPoints = points.filter(point => 
            typeof point.x === 'number' && !isNaN(point.x) &&
            typeof point.y === 'number' && !isNaN(point.y)
        );

        if (validPoints.length === 0) {
            return { x: 0, y: 0 };
        }

        const sum = validPoints.reduce((acc, point) => ({
            x: acc.x + point.x,
            y: acc.y + point.y
        }), { x: 0, y: 0 });
        
        return {
            x: parseFloat((sum.x / validPoints.length).toFixed(2)),
            y: parseFloat((sum.y / validPoints.length).toFixed(2))
        };
    }
    
    isPointInPolygon(point, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            
            const intersect = ((yi > point.y) !== (yj > point.y))
                && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }
    
    handleHotspotClick(hotspot) {
        // Set current hotspot
        this.currentHotspot = hotspot;
        
        if (hotspot.type === 'primary') {
            // Handle primary hotspot click
            this.showTransition(hotspot._id);
            this.stateIndicator.textContent = 'Current State: Transition View';
        } else if (hotspot.type === 'secondary') {
            // Handle secondary hotspot click
            this.showInfoPanel(hotspot);
        }
    }
    
    async showTransition(hotspotId) {
        try {
            // Hide house selector when transitioning
            if (this.houseSelector) {
                this.houseSelector.style.display = 'none';
            }

            console.log('Starting transition for hotspot:', hotspotId);

            // Get the playlist for this hotspot
            const playlistResponse = await fetch(`/api/playlists?houseId=${this.currentHouse}`);
            if (!playlistResponse.ok) throw new Error('Failed to load playlist');
            const playlistData = await playlistResponse.json();
            
            // Get the playlist for this hotspot from the playlists map
            const playlist = playlistData.playlists[hotspotId];
            console.log('Playlist data for transition:', playlist);
            console.log('Dive-in video ID from playlist:', playlist?.diveIn?.videoId);

            if (!playlist || !playlist.diveIn || !playlist.diveIn.videoId) {
                console.error('No dive-in video assigned in playlist for hotspot:', hotspotId);
                await this.showFloorLevel(playlist, hotspotId);
                return;
            }

            // Get the dive-in video asset
            const assetsResponse = await fetch(`/api/assets?houseId=${this.currentHouse}`);
            if (!assetsResponse.ok) throw new Error('Failed to load assets');
            const assetsData = await assetsResponse.json();
            console.log('Available assets:', assetsData.assets);
            
            const diveInAsset = assetsData.assets.find(a => a._id === playlist.diveIn.videoId);
            console.log('Found dive-in asset:', diveInAsset);
            
            if (!diveInAsset) {
                console.error('Dive-in video not found in assets:', playlist.diveIn.videoId);
                await this.showFloorLevel(playlist, hotspotId);
                return;
            }

            if (!diveInAsset.url) {
                console.error('Dive-in video has no URL:', diveInAsset);
                await this.showFloorLevel(playlist, hotspotId);
                return;
            }

            // Ensure video container exists
            this.initializeViews();

            // Get video container and placeholder
            const videoContainer = this.transitionView.querySelector('.video-container');
            const videoPlaceholder = videoContainer.querySelector('.video-placeholder');

            if (!videoContainer || !videoPlaceholder) {
                throw new Error('Video container not properly initialized');
            }

            // Update container styles to ensure visibility
            videoContainer.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: black;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            `;

            videoPlaceholder.style.cssText = `
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
            `;

            // Create new video element
            const newVideo = document.createElement('video');
            newVideo.className = 'preview-video';
            newVideo.muted = true;
            newVideo.playsInline = true;
            newVideo.autoplay = true;
            newVideo.loop = false;
            newVideo.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
                position: absolute;
                top: 0;
                left: 0;
                z-index: 1001;
            `;

            // Add event listeners for debugging
            newVideo.addEventListener('loadstart', () => console.log('Video load started'));
            newVideo.addEventListener('loadeddata', () => console.log('Video data loaded'));
            newVideo.addEventListener('canplay', () => console.log('Video can play'));
            newVideo.addEventListener('playing', () => console.log('Video is playing'));
            newVideo.addEventListener('error', (e) => {
                console.error('Video error:', e);
                console.error('Video error code:', newVideo.error?.code);
                console.error('Video error message:', newVideo.error?.message);
            });

            // Set video source
            newVideo.src = diveInAsset.url;
            console.log('Loading dive-in video:', diveInAsset.url);

            // Clear and update video placeholder
            videoPlaceholder.innerHTML = '';
            videoPlaceholder.appendChild(newVideo);

            // Add asset label
            const label = document.createElement('div');
            label.className = 'asset-label';
            label.textContent = `Dive-in Video: ${diveInAsset.name || 'Unnamed'}`;
            label.style.zIndex = '2000';
            videoContainer.appendChild(label);

            // After creating newVideo and before showing transition view
            const transitionContainer = this.transitionView.querySelector('.video-container');
            
            // Add playback clock for transition video
            const existingClock = transitionContainer.querySelector('.playback-clock');
            if (existingClock) {
                existingClock.remove();
            }
            const clock = this.createPlaybackClock(transitionContainer);
            this.updatePlaybackClock(newVideo, clock);
            this.playbackClocks.set('transition', clock);

            // Show transition view
            this.aerialView.style.display = 'none';
            this.transitionView.style.display = 'block';
            this.transitionView.style.zIndex = '1000';

            // Reset and play the video
            newVideo.currentTime = 0;
            try {
                const playPromise = newVideo.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        console.log('Playing dive-in video');
                    }).catch(error => {
                        console.error('Error playing video:', error);
                        // Try to play again after a short delay
                        setTimeout(async () => {
                            try {
                                await newVideo.play();
                                console.log('Playing dive-in video after retry');
                            } catch (retryError) {
                                console.error('Error playing video after retry:', retryError);
                                // If still failing, try to show floor level
                                await this.showFloorLevel(playlist, hotspotId);
                            }
                        }, 1000);
                    });
                }
            } catch (error) {
                console.error('Error in video play attempt:', error);
                await this.showFloorLevel(playlist, hotspotId);
            }

            // When video ends, show floor level
            newVideo.onended = async () => {
                console.log('Dive-in video ended, showing floor level');
                await this.showFloorLevel(playlist, hotspotId);
            };
        } catch (error) {
            console.error('Error in showTransition:', error);
            this.returnToAerial();
        }
    }
    
    async showFloorLevel(playlist, hotspotId) {
        try {
            // Hide house selector when showing floor level
            if (this.houseSelector) {
                this.houseSelector.style.display = 'none';
            }

            // Update state indicator
            this.stateIndicator.textContent = 'Current State: Floor Level View';

            // If no playlist was provided, try to get it
            if (!playlist) {
                const playlistResponse = await fetch(`/api/playlists?houseId=${this.currentHouse}`);
                if (!playlistResponse.ok) throw new Error('Failed to load playlist');
                const playlistData = await playlistResponse.json();
                playlist = playlistData.playlists[hotspotId];
            }

            console.log('Floor level playlist data:', playlist);

            if (!playlist || !playlist.floorLevel || !playlist.floorLevel.videoId) {
                console.log('No floor level video assigned, returning to aerial view');
                this.returnToAerial();
                return;
            }

            // Get the floor level video asset
            const assetsResponse = await fetch(`/api/assets?houseId=${this.currentHouse}`);
            if (!assetsResponse.ok) throw new Error('Failed to load assets');
            const assetsData = await assetsResponse.json();
            const floorLevelAsset = assetsData.assets.find(a => a._id === playlist.floorLevel.videoId);
            
            if (!floorLevelAsset) {
                console.log('Floor level video not found, returning to aerial view');
                this.returnToAerial();
                return;
            }

            // Ensure video container exists
            this.initializeViews();

            // Get video container and placeholder
            const videoContainer = this.floorLevelView.querySelector('.video-container');
            const videoPlaceholder = videoContainer.querySelector('.video-placeholder');

            if (!videoContainer || !videoPlaceholder) {
                throw new Error('Video container not properly initialized');
            }

            // Create new video element
            const newFloorLevelVideo = document.createElement('video');
            newFloorLevelVideo.className = 'preview-video';
            newFloorLevelVideo.muted = true;
            newFloorLevelVideo.playsInline = true;
            newFloorLevelVideo.loop = false;
            newFloorLevelVideo.autoplay = true;
            newFloorLevelVideo.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
                position: absolute;
                top: 0;
                left: 0;
            `;
            newFloorLevelVideo.src = floorLevelAsset.url;
            console.log('Loading floor level video:', floorLevelAsset.url);
            
            // Add event listeners for debugging
            newFloorLevelVideo.addEventListener('loadstart', () => console.log('Floor level video load started'));
            newFloorLevelVideo.addEventListener('loadeddata', () => console.log('Floor level video data loaded'));
            newFloorLevelVideo.addEventListener('canplay', () => console.log('Floor level video can play'));
            newFloorLevelVideo.addEventListener('playing', () => console.log('Floor level video is playing'));
            newFloorLevelVideo.addEventListener('error', (e) => console.error('Floor level video error:', e));
            newFloorLevelVideo.addEventListener('ended', async () => {
                console.log('Floor level video ended, playing zoom out video');
                // Play zoom out video instead of returning to aerial view
                await this.playZoomOutVideo(playlist, hotspotId);
            });

            // Clear and update video placeholder
            videoPlaceholder.innerHTML = '';
            videoPlaceholder.appendChild(newFloorLevelVideo);

            // Add asset label
            const label = document.createElement('div');
            label.className = 'asset-label';
            label.textContent = `Floor Level Video: ${floorLevelAsset.name || 'Unnamed'}`;
            videoContainer.appendChild(label);

            // After creating newFloorLevelVideo and before showing floor level view
            const floorLevelContainer = this.floorLevelView.querySelector('.video-container');
            
            // Add playback clock for floor level video
            const existingClock = floorLevelContainer.querySelector('.playback-clock');
            if (existingClock) {
                existingClock.remove();
            }
            const clock = this.createPlaybackClock(floorLevelContainer);
            this.updatePlaybackClock(newFloorLevelVideo, clock);
            this.playbackClocks.set('floorLevel', clock);

            // Show floor level view
            this.transitionView.style.display = 'none';
            this.floorLevelView.style.display = 'block';

            // Reset and play the video
            newFloorLevelVideo.currentTime = 0;
            try {
                await newFloorLevelVideo.play();
                console.log('Playing floor level video');
            } catch (error) {
                console.error('Error playing floor level video:', error);
                // Try to play again after a short delay
                setTimeout(async () => {
                    try {
                        await newFloorLevelVideo.play();
                        console.log('Playing floor level video after retry');
                    } catch (retryError) {
                        console.error('Error playing floor level video after retry:', retryError);
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('Error in showFloorLevel:', error);
            this.returnToAerial();
        }
    }
    
    returnToAerial() {
        this.transitionView.style.display = 'none';
        this.floorLevelView.style.display = 'none';
        this.aerialView.style.display = 'block';
        this.aerialVideo.play();
        this.stateIndicator.textContent = 'Current State: Aerial View';
        
        // Show house selector when returning to aerial view
        if (this.houseSelector) {
            this.houseSelector.style.display = 'block';
        }
    }
    
    showInfoPanel(hotspot) {
        // Remove any existing floating info panels
        const existingFloatingPanels = document.querySelectorAll('.floating-info-panel');
        existingFloatingPanels.forEach(panel => panel.remove());
        
        // Create floating info panel
        const infoPanel = document.createElement('div');
        infoPanel.className = 'floating-info-panel';
        
        // Get hotspot position
        const hotspotElement = this.hotspotContainer.querySelector(`[data-id="${hotspot._id}"]`);
        const hotspotRect = hotspotElement.getBoundingClientRect();
        const containerRect = this.hotspotContainer.getBoundingClientRect();
        
        // Calculate position (place panel to the right of the hotspot)
        const panelX = hotspotRect.right - containerRect.left;
        const panelY = hotspotRect.top - containerRect.top;
        
        infoPanel.style.left = `${panelX + 10}px`; // 10px offset from hotspot
        infoPanel.style.top = `${panelY}px`;
        
        infoPanel.innerHTML = `
            <div class="floating-info-header">
                <h3>${hotspot.title}</h3>
                <button class="close-btn" type="button">&times;</button>
            </div>
            <div class="floating-info-content">
                <p>${hotspot.description || 'No description available.'}</p>
            </div>
        `;
        
        // Add close button functionality
        const closeBtn = infoPanel.querySelector('.close-btn');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling
            infoPanel.style.opacity = '0';
            setTimeout(() => infoPanel.remove(), 300);
        });
        
        // Add click outside to close
        const closeOnClickOutside = (e) => {
            if (!infoPanel.contains(e.target) && !hotspotElement.contains(e.target)) {
                infoPanel.style.opacity = '0';
                setTimeout(() => {
                    infoPanel.remove();
                    document.removeEventListener('click', closeOnClickOutside);
                }, 300);
            }
        };
        
        // Delay adding the click outside listener to prevent immediate trigger
        setTimeout(() => {
            document.addEventListener('click', closeOnClickOutside);
        }, 100);
        
        this.hotspotContainer.appendChild(infoPanel);
        
        // Show panel with animation
        infoPanel.style.opacity = '0';
        setTimeout(() => {
            infoPanel.style.opacity = '1';
        }, 10);
    }
    
    async handleBackToAerial() {
        try {
            // Get the playlist for the current house
            const playlistResponse = await fetch(`/api/playlists?houseId=${this.currentHouse}`);
            if (!playlistResponse.ok) throw new Error('Failed to load playlist');
            const playlistData = await playlistResponse.json();
            
            // Get the playlist for the current hotspot
            const currentHotspot = this.currentHotspot;
            if (!currentHotspot) {
                throw new Error('No current hotspot found');
            }

            const playlist = playlistData.playlists[currentHotspot._id];
            if (!playlist || !playlist.zoomOut || !playlist.zoomOut.videoId) {
                throw new Error('Zoom out video not found in playlist');
            }

            // Get the zoom out video asset
            const assetsResponse = await fetch(`/api/assets?houseId=${this.currentHouse}`);
            if (!assetsResponse.ok) throw new Error('Failed to load assets');
            const assetsData = await assetsResponse.json();
            const zoomOutAsset = assetsData.assets.find(a => a._id === playlist.zoomOut.videoId);
            
            if (!zoomOutAsset) {
                throw new Error('Zoom out video not found in assets');
            }

            // Get video container and placeholder
            const videoContainer = this.transitionView.querySelector('.video-container');
            const videoPlaceholder = videoContainer.querySelector('.video-placeholder');

            // Create new video element
            const newVideo = document.createElement('video');
            newVideo.className = 'preview-video';
            newVideo.muted = true;
            newVideo.playsInline = true;
            newVideo.autoplay = true;
            newVideo.loop = false;
            newVideo.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
                position: absolute;
                top: 0;
                left: 0;
            `;
            newVideo.src = zoomOutAsset.url;

            // Clear and update video placeholder
            videoPlaceholder.innerHTML = '';
            videoPlaceholder.appendChild(newVideo);

            // Add asset label
            const label = document.createElement('div');
            label.className = 'asset-label';
            label.textContent = `Zoom Out Video: ${zoomOutAsset.name || 'Unnamed'}`;
            videoContainer.appendChild(label);

            // Add playback clock for zoom out video
            const existingClock = videoContainer.querySelector('.playback-clock');
            if (existingClock) {
                existingClock.remove();
            }
            const clock = this.createPlaybackClock(videoContainer);
            this.updatePlaybackClock(newVideo, clock);
            this.playbackClocks.set('zoomOut', clock);

            // Show transition view
            this.floorLevelView.style.display = 'none';
            this.transitionView.style.display = 'block';

            // Reset and play the video
            newVideo.currentTime = 0;
            try {
                await newVideo.play();
                console.log('Playing zoom out video');
            } catch (error) {
                console.error('Error playing zoom out video:', error);
                // Try to play again after a short delay
                setTimeout(async () => {
                    try {
                        await newVideo.play();
                        console.log('Playing zoom out video after retry');
                    } catch (retryError) {
                        console.error('Error playing zoom out video after retry:', retryError);
                    }
                }, 1000);
            }

            // When zoom out video ends, return to aerial view
            newVideo.onended = () => {
                console.log('Zoom out video ended, returning to aerial view');
                this.returnToAerial();
            };
        } catch (error) {
            console.error('Error in handleBackToAerial:', error);
            // Show error to user
            this.stateIndicator.textContent = 'Error: ' + error.message;
            // Return to aerial view after a short delay
            setTimeout(() => {
                this.transitionView.style.display = 'none';
                this.floorLevelView.style.display = 'none';
                this.aerialView.style.display = 'block';
                this.aerialVideo.currentTime = 0;
                this.aerialVideo.play();
                this.stateIndicator.textContent = 'Current State: Aerial View';
            }, 3000);
        }
    }
    
    handleVideoEnd() {
        // Reset views
        this.floorLevelView.style.display = 'none';
        this.transitionView.style.display = 'none';
        
        setTimeout(() => {
            this.transitionView.style.display = 'none';
            this.aerialView.style.display = 'block';
            
            // Update state indicator
            if (this.stateIndicator) {
                this.stateIndicator.textContent = 'Current State: Aerial View';
            }
        }, 2000);
    }

    async refreshAllData() {
        try {
            // Show loading state
            this.updateButton.textContent = 'Updating...';
            this.updateButton.disabled = true;

            // Clear only the hotspots, preserving other elements
            const existingHotspots = this.hotspotContainer.querySelectorAll('.hotspot');
            existingHotspots.forEach(hotspot => hotspot.remove());

            // Reload all videos and assets
            await this.loadAssets();

            // Fetch and update hotspots
            const response = await fetch(`/api/hotspots?houseId=${this.currentHouse}`);
            if (!response.ok) throw new Error('Failed to load hotspots');
            const data = await response.json();
            
            if (data && data.hotspots) {
                // Update hotspots array and render them
                this.hotspots = data.hotspots;
                this.renderHotspots();
            }

            // Show success state
            this.updateButton.textContent = 'Updated!';
            setTimeout(() => {
                this.updateButton.textContent = 'Update';
                this.updateButton.disabled = false;
            }, 2000);

        } catch (error) {
            console.error('Error refreshing data:', error);
            this.updateButton.textContent = 'Update Failed';
            setTimeout(() => {
                this.updateButton.textContent = 'Update';
                this.updateButton.disabled = false;
            }, 2000);
        }
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    createPlaybackClock(container) {
        const clock = document.createElement('div');
        clock.className = 'playback-clock';
        clock.textContent = '00:00';
        container.appendChild(clock);
        return clock;
    }

    updatePlaybackClock(video, clock) {
        if (!video || !clock) return;
        
        const updateTime = () => {
            clock.textContent = this.formatTime(video.currentTime);
        };
        
        video.addEventListener('timeupdate', updateTime);
        updateTime(); // Initial update
    }

    // Add new method to play zoom out video
    async playZoomOutVideo(playlist, hotspotId) {
        try {
            // Hide house selector during zoom out
            if (this.houseSelector) {
                this.houseSelector.style.display = 'none';
            }

            if (!playlist || !playlist.zoomOut || !playlist.zoomOut.videoId) {
                console.log('No zoom out video assigned, returning to aerial view');
                this.returnToAerial();
                return;
            }

            // Update state indicator
            this.stateIndicator.textContent = 'Current State: Zoom Out View';

            // Get the zoom out video asset
            const assetsResponse = await fetch(`/api/assets?houseId=${this.currentHouse}`);
            if (!assetsResponse.ok) throw new Error('Failed to load assets');
            const assetsData = await assetsResponse.json();
            const zoomOutAsset = assetsData.assets.find(a => a._id === playlist.zoomOut.videoId);
            
            if (!zoomOutAsset) {
                console.log('Zoom out video not found, returning to aerial view');
                this.returnToAerial();
                return;
            }

            // Get video container and placeholder
            const videoContainer = this.transitionView.querySelector('.video-container');
            const videoPlaceholder = videoContainer.querySelector('.video-placeholder');

            // Create new video element
            const newVideo = document.createElement('video');
            newVideo.className = 'preview-video';
            newVideo.muted = true;
            newVideo.playsInline = true;
            newVideo.autoplay = true;
            newVideo.loop = false;
            newVideo.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
                position: absolute;
                top: 0;
                left: 0;
            `;
            newVideo.src = zoomOutAsset.url;

            // Clear and update video placeholder
            videoPlaceholder.innerHTML = '';
            videoPlaceholder.appendChild(newVideo);

            // Add asset label
            const label = document.createElement('div');
            label.className = 'asset-label';
            label.textContent = `Zoom Out Video: ${zoomOutAsset.name || 'Unnamed'}`;
            videoContainer.appendChild(label);

            // Add playback clock for zoom out video
            const existingClock = videoContainer.querySelector('.playback-clock');
            if (existingClock) {
                existingClock.remove();
            }
            const clock = this.createPlaybackClock(videoContainer);
            this.updatePlaybackClock(newVideo, clock);
            this.playbackClocks.set('zoomOut', clock);

            // Show transition view
            this.floorLevelView.style.display = 'none';
            this.transitionView.style.display = 'block';

            // Reset and play the video
            newVideo.currentTime = 0;
            try {
                await newVideo.play();
                console.log('Playing zoom out video');
            } catch (error) {
                console.error('Error playing zoom out video:', error);
                // Try to play again after a short delay
                setTimeout(async () => {
                    try {
                        await newVideo.play();
                        console.log('Playing zoom out video after retry');
                    } catch (retryError) {
                        console.error('Error playing zoom out video after retry:', retryError);
                    }
                }, 1000);
            }

            // When zoom out video ends, return to aerial view
            newVideo.onended = () => {
                console.log('Zoom out video ended, returning to aerial view');
                this.returnToAerial();
            };
        } catch (error) {
            console.error('Error in playZoomOutVideo:', error);
            this.returnToAerial();
        }
    }
}

// Initialize the HotspotManager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.hotspotManager = new HotspotManager();
    
    // Add event listener for house selection
    if (window.hotspotManager.houseSelector) {
        window.hotspotManager.houseSelector.addEventListener('change', (e) => {
            window.hotspotManager.currentHouse = parseInt(e.target.value);
            window.hotspotManager.loadHotspots();
        });
    }
    
    // Add event listener for video end
    if (window.hotspotManager.floorLevelVideo) {
        window.hotspotManager.floorLevelVideo.addEventListener('ended', () => {
            window.hotspotManager.handleVideoEnd();
        });
    }
    
    // Add event listener for window focus to check for updates
    if (window) {
        window.addEventListener('focus', () => {
            window.hotspotManager.checkForUpdates();
        });
    }
});