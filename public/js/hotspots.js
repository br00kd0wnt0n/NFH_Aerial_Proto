class HotspotManager {
    constructor() {
        console.log('Initializing HotspotManager');
        this.hotspotContainer = document.querySelector('#hotspotContainer');
        console.log('Hotspot container:', this.hotspotContainer);
        this.hotspots = new Map();
        this.playbackClocks = new Map();
        this.currentHouse = 1;
        this.currentHotspot = null;
        this.isLoading = false;
        this.preloadedVideos = new Map(); // Store preloaded video elements
        
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
        
        this.isPreloading = false;
        this.preloadProgress = 0;
        this.totalVideosToPreload = 0;
        this.loadedVideos = 0;
        
        // Initialize views first
        this.initializeViews();
        
        // Initialize video elements synchronously
        this.initializeVideoElements();
        
        // Initialize event listeners
        this.initializeEventListeners();

        // Start preloading videos and wait for completion
        this.initializeAndPreload();

        this.isPlaying = false;  // Add play state tracking
        this.playPromise = null; // Add promise to track play operations
    }
    
    initializeVideoElements() {
        console.log('Initializing video elements');
        
        // Create video elements if they don't exist
        if (!document.getElementById('aerialVideo')) {
            const aerialVideo = document.createElement('video');
            aerialVideo.id = 'aerialVideo';
            aerialVideo.className = 'preview-video';
            aerialVideo.muted = true;
            aerialVideo.playsInline = true;
            aerialVideo.autoplay = true;
            aerialVideo.loop = true;
            this.aerialView.querySelector('.video-container .video-placeholder').appendChild(aerialVideo);
        }
        
        if (!document.getElementById('transitionVideo')) {
            const transitionVideo = document.createElement('video');
            transitionVideo.id = 'transitionVideo';
            transitionVideo.className = 'preview-video';
            transitionVideo.muted = true;
            transitionVideo.playsInline = true;
            transitionVideo.autoplay = true;
            transitionVideo.loop = false;
            this.transitionView.querySelector('.video-container .video-placeholder').appendChild(transitionVideo);
        }
        
        if (!document.getElementById('floorLevelVideo')) {
            const floorLevelVideo = document.createElement('video');
            floorLevelVideo.id = 'floorLevelVideo';
            floorLevelVideo.className = 'preview-video';
            floorLevelVideo.muted = true;
            floorLevelVideo.playsInline = true;
            floorLevelVideo.autoplay = true;
            floorLevelVideo.loop = false;
            this.floorLevelView.querySelector('.video-container .video-placeholder').appendChild(floorLevelVideo);
        }
        
        // Get references to video elements
        this.aerialVideo = document.getElementById('aerialVideo');
        this.transitionVideo = document.getElementById('transitionVideo');
        this.floorLevelVideo = document.getElementById('floorLevelVideo');
        
        console.log('Video Elements:', {
            aerialVideo: this.aerialVideo,
            transitionVideo: this.transitionVideo,
            floorLevelVideo: this.floorLevelVideo
        });
        
        if (!this.aerialVideo || !this.transitionVideo || !this.floorLevelVideo) {
            console.error('Failed to initialize video elements');
            throw new Error('Failed to initialize video elements');
        }
    }
    
    initializeViews() {
        // Set up aerial view
        this.aerialView.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: black;
            z-index: 1;
            display: block;
        `;

        // Set up transition view
        this.transitionView.style.cssText = `
            position: fixed;
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
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: black;
            z-index: 3;
            display: none;
        `;

        // Create persistent video containers
        const createVideoContainer = (view, videoElement) => {
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

            if (videoElement) {
                videoElement.style.cssText = `
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                `;
                placeholder.appendChild(videoElement);
            }
        };

        // Create containers while preserving video elements
        createVideoContainer(this.transitionView, this.transitionVideo);
        createVideoContainer(this.floorLevelView, this.floorLevelVideo);

        // Ensure state indicator is always visible
        if (this.stateIndicator) {
            this.stateIndicator.style.cssText = `
                position: fixed;
                top: 10px;
                left: 10px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 5px 10px;
                border-radius: 4px;
                z-index: 9999;
            `;
        }

        console.log('Views initialized:', {
            aerialView: this.aerialView.style.display,
            transitionView: this.transitionView.style.display,
            floorLevelView: this.floorLevelView.style.display
        });
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
        
        // Handle tab visibility changes
        if (document) {
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    // Tab is hidden - pause videos and store current state
                    this.storeVideoState();
                } else {
                    // Tab is visible - restore video state
                    this.restoreVideoState();
                }
            });
        }

        // Listen for reload events
        if (window) {
            window.addEventListener('focus', () => {
                this.checkForUpdates();
                this.restoreVideoState();
            });
        }

        // Add click handler for update button
        if (this.updateButton) {
            this.updateButton.addEventListener('click', () => this.refreshAllData());
            this.updateButton.onmouseover = () => this.updateButton.style.opacity = '0.8';
            this.updateButton.onmouseout = () => this.updateButton.style.opacity = '1';
        }
    }
    
    // Store current video state
    async storeVideoState() {
        if (this.aerialVideo) {
            this._storedVideoState = {
                currentTime: this.aerialVideo.currentTime,
                isPlaying: !this.aerialVideo.paused,
                src: this.aerialVideo.src
            };
            // Pause the video when tab is hidden using safe pause
            await this.safePause(this.aerialVideo);
        }
    }

    // Restore video state
    async restoreVideoState() {
        if (this._storedVideoState && this.aerialVideo) {
            // Only restore if the video source hasn't changed
            if (this.aerialVideo.src === this._storedVideoState.src) {
                this.aerialVideo.currentTime = this._storedVideoState.currentTime;
                if (this._storedVideoState.isPlaying) {
                    try {
                        await this.safePlay(this.aerialVideo);
                    } catch (error) {
                        console.error('Error restoring video playback:', error);
                    }
                }
            }
        }
    }
    
    async checkForUpdates() {
        try {
            const response = await fetch(`/api/hotspots?houseId=${this.currentHouse}&checkUpdate=true&_=${Date.now()}`);
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
            console.log('Reloading hotspot manager...');
            
            // Clear existing state
            this.clearHotspots();
            this.assets = [];
            this.hotspots = [];
            this.currentHotspot = null;
            
            // Reset video elements
            if (this.aerialVideo) {
                this.aerialVideo.src = '';
                this.aerialVideo.load();
            }
            if (this.transitionVideo) {
                this.transitionVideo.src = '';
                this.transitionVideo.load();
            }
            if (this.floorLevelVideo) {
                this.floorLevelVideo.src = '';
                this.floorLevelVideo.load();
            }
            
            // Load new data
            await Promise.all([
                this.loadAssets(),
                this.loadHotspots()
            ]);
            
            // Re-render hotspots
            this.renderHotspots();
            
            // Re-initialize and preload videos for the new house
            await this.initializeAndPreload();
            
            // Ensure we're showing the aerial view
            await this.showAerialView();
            
            console.log('Hotspot manager reloaded successfully');
        } catch (error) {
            console.error('Error reloading hotspot manager:', error);
            throw error;
        }
    }
    
    async loadHotspots() {
        try {
            console.log('Loading hotspots for house:', this.currentHouse);
            const response = await fetch(`/api/hotspots?houseId=${this.currentHouse}&_=${Date.now()}`);
            if (!response.ok) {
                throw new Error('Failed to load hotspots');
            }
            
            const data = await response.json();
            console.log('Received hotspot data:', data);
            
            if (!data || !data.hotspots) {
                throw new Error('Invalid response format');
            }
            
            this.hotspots.clear();
            data.hotspots.forEach(hotspot => this.createHotspot(hotspot));
            this.renderHotspots();
        } catch (error) {
            console.error('Error loading hotspots:', error);
        }
    }
    
    async loadAssets() {
        if (this.isLoading) {
            console.log('Assets loading already in progress, skipping...');
            return;
        }
        
        this.isLoading = true;
        try {
            // Store current video state before loading new assets
            const previousState = this._storedVideoState;
            
            // Load house videos and assets in parallel
            const [houseVideosResponse, houseAssetsResponse] = await Promise.all([
                fetch(`/api/house-videos?houseId=${this.currentHouse}&_=${Date.now()}`),
                fetch(`/api/assets?houseId=${this.currentHouse}&_=${Date.now()}`)
            ]);

            if (!houseVideosResponse.ok) throw new Error('Failed to load house videos');
            if (!houseAssetsResponse.ok) throw new Error('Failed to load house assets');

            const { houseVideo } = await houseVideosResponse.json();
            const houseAssetsData = await houseAssetsResponse.json();
            
            console.log('House videos response:', houseVideo);
            console.log('House assets response:', houseAssetsData);

            if (!houseVideo) {
                throw new Error('Invalid house videos response format');
            }
            if (!houseAssetsData || !houseAssetsData.assets) {
                throw new Error('Invalid house assets response format');
            }

            // Store house assets for later use
            this.assets = houseAssetsData.assets;

            // Handle house aerial video
            if (!houseVideo.aerial?.videoId) {
                console.log('No aerial video configured for house:', this.currentHouse);
                return;
            }

            const aerialAsset = this.assets.find(a => a._id === houseVideo.aerial.videoId);
            if (!aerialAsset) {
                console.log('Aerial video not found in assets:', houseVideo.aerial.videoId);
                return;
            }

            console.log('Found aerial asset:', aerialAsset);
            const aerialVideo = document.getElementById('aerialVideo');
            if (!aerialVideo) {
                console.error('Aerial video element not found');
                return;
            }

            // Only update video if source is changing
            const isNewSource = aerialVideo.src !== aerialAsset.url;
            if (isNewSource) {
                console.log('Updating aerial video source to:', aerialAsset.url);
                aerialVideo.pause();
                aerialVideo.src = aerialAsset.url;
                aerialVideo.load();
                
                // Add event listeners for video loading
                aerialVideo.addEventListener('loadedmetadata', () => {
                    console.log('Aerial video metadata loaded:', {
                        width: aerialVideo.videoWidth,
                        height: aerialVideo.videoHeight,
                        duration: aerialVideo.duration
                    });
                    this.renderHotspots();
                });

                aerialVideo.addEventListener('canplay', () => {
                    console.log('Aerial video can play, starting playback');
                    aerialVideo.play().catch(error => {
                        console.error('Error playing aerial video:', error);
                    });
                });

                aerialVideo.addEventListener('error', (e) => {
                    console.error('Error loading aerial video:', {
                        error: e,
                        videoError: aerialVideo.error,
                        src: aerialVideo.src
                    });
                });
            } else if (previousState) {
                // Restore previous state if source hasn't changed
                this._storedVideoState = previousState;
                this.restoreVideoState();
            }

            // Add asset label
            const videoContainer = this.aerialView.querySelector('.video-container');
            const existingLabel = videoContainer.querySelector('.asset-label');
            if (existingLabel) {
                existingLabel.remove();
            }
            const label = document.createElement('div');
            label.className = 'asset-label';
            label.textContent = `House ${this.currentHouse} Aerial Video: ${aerialAsset.name || 'Unnamed'}`;
            videoContainer.appendChild(label);

        } catch (error) {
            console.error('Error loading assets:', error);
            const videoContainer = this.aerialView.querySelector('.video-container');
            if (videoContainer) {
                videoContainer.innerHTML = `
                    <div class="alert alert-danger m-3">
                        Error loading assets. Please refresh the page.
                    </div>
                `;
            }
        } finally {
            this.isLoading = false;
        }
    }
    
    renderHotspots() {
        // Clear existing hotspots
        const container = document.querySelector('.hotspot-container');
        if (!container) {
            console.error('Hotspot container not found');
            return;
        }
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
        this.hotspots.forEach((hotspotData, hotspotId) => {
            const hotspot = hotspotData.data;
            console.log('Creating polygon for hotspot:', JSON.stringify(hotspot, null, 2));
            
            if (!hotspot.points || !Array.isArray(hotspot.points) || hotspot.points.length < 3) {
                console.error('Invalid points data for hotspot:', JSON.stringify(hotspot, null, 2));
                return;
            }
            
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.setAttribute('class', 'hotspot');
            group.setAttribute('data-id', hotspotId);
            group.style.pointerEvents = 'all';
            group.style.cursor = 'pointer';
            group.style.transform = 'none';
            group.style.transition = 'none';
            
            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            
            // Convert points to SVG polygon points string
            const pointsString = hotspot.points.map(point => {
                // Handle both object format {x, y} and array format [x, y]
                const x = typeof point === 'object' ? point.x : point[0];
                const y = typeof point === 'object' ? point.y : point[1];
                // Convert percentage to actual pixel coordinates
                const pixelX = (x / 100) * videoWidth;
                const pixelY = (y / 100) * videoHeight;
                return `${pixelX},${pixelY}`;
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
            // Store current aerial video state before transition
            this.storeVideoState();
            
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
            // Hide house selector during transition
            const houseSelector = document.getElementById('houseSelector');
            if (houseSelector) {
                houseSelector.style.display = 'none';
            }

            // Fetch videos for this hotspot
            const hotspotVideos = await this.fetchVideosForHotspot(hotspotId);
            if (!hotspotVideos) {
                throw new Error('Failed to load hotspot videos');
            }

            // Check if we have a dive-in video
            if (!hotspotVideos.diveIn?.videoId) {
                console.warn('No dive-in video found for hotspot:', hotspotId);
                await this.showAerialView();
                return;
            }

            // Completely remove and recreate the transition view container
            if (this.transitionView) {
                // Remove all existing content
                while (this.transitionView.firstChild) {
                    this.transitionView.removeChild(this.transitionView.firstChild);
                }

                // Create new container structure
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
                this.transitionView.appendChild(container);
            }

            // Create new video element
            const video = document.createElement('video');
            video.className = 'preview-video';
            video.muted = false;
            video.playsInline = true;
            video.autoplay = true;
            video.loop = false;
            video.preload = 'auto';
            video.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
            `;

            // Get the new container and placeholder
            const videoContainer = this.transitionView.querySelector('.video-container');
            const videoPlaceholder = videoContainer.querySelector('.video-placeholder');

            // Clear and update video placeholder
            videoPlaceholder.innerHTML = '';
            videoPlaceholder.appendChild(video);

            // Show transition view
            this.transitionView.style.display = 'block';
            console.log('Transition view recreated and displayed');

            // Show loading state
            this.updateStateIndicator('Loading dive-in video...');

            // Wait for video to be ready
            const videoReady = new Promise((resolve, reject) => {
                let hasLoadedMetadata = false;
                let hasLoadedData = false;
                let hasCanPlay = false;
                let isResolved = false;
                let readyTimeout;

                const cleanup = () => {
                    if (isResolved) return;
                    clearTimeout(readyTimeout);
                    video.removeEventListener('loadedmetadata', metadataHandler);
                    video.removeEventListener('loadeddata', dataHandler);
                    video.removeEventListener('canplay', canPlayHandler);
                    video.removeEventListener('error', errorHandler);
                };

                const checkReady = () => {
                    if (isResolved) return;
                    if (hasLoadedMetadata && hasLoadedData && hasCanPlay) {
                        console.log('Dive-in video fully ready:', hotspotVideos.diveIn.name);
                        isResolved = true;
                        cleanup();
                        resolve();
                    }
                };

                const metadataHandler = () => {
                    if (isResolved) return;
                    console.log('Loaded metadata for dive-in video:', hotspotVideos.diveIn.name);
                    hasLoadedMetadata = true;
                    checkReady();
                };

                const dataHandler = () => {
                    if (isResolved) return;
                    console.log('Loaded data for dive-in video:', hotspotVideos.diveIn.name);
                    hasLoadedData = true;
                    checkReady();
                };

                const canPlayHandler = () => {
                    if (isResolved) return;
                    console.log('Dive-in video can play:', hotspotVideos.diveIn.name);
                    hasCanPlay = true;
                    checkReady();
                };

                const errorHandler = (e) => {
                    if (isResolved) return;
                    console.error('Error loading dive-in video:', hotspotVideos.diveIn.name, e);
                    cleanup();
                    reject(new Error('Failed to load dive-in video'));
                };

                readyTimeout = setTimeout(() => {
                    if (!isResolved) {
                        console.warn('Timeout waiting for dive-in video to be ready:', hotspotVideos.diveIn.name);
                        cleanup();
                        reject(new Error('Video ready timeout'));
                    }
                }, 60000);

                video.addEventListener('loadedmetadata', metadataHandler);
                video.addEventListener('loadeddata', dataHandler);
                video.addEventListener('canplay', canPlayHandler);
                video.addEventListener('error', errorHandler);

                video.src = hotspotVideos.diveIn.url;
                video.load();
            });

            await videoReady;

            // Update state
            this.updateStateIndicator('Playing dive-in video...');

            // Attempt playback with retry logic
            let retryCount = 0;
            const maxRetries = 3;
            const baseRetryDelay = 1000;
            const maxRetryDelay = 5000;

            const attemptPlayback = async () => {
                try {
                    console.log(`Attempting to play dive-in video (attempt ${retryCount + 1}/${maxRetries})`);
                    await video.play();
                    console.log('Dive-in video playback started successfully');
                } catch (error) {
                    console.warn(`Playback attempt ${retryCount + 1} failed:`, error);
                    
                    if (retryCount < maxRetries) {
                        retryCount++;
                        const delay = Math.min(baseRetryDelay * Math.pow(2, retryCount), maxRetryDelay);
                        console.log(`Retrying playback in ${Math.round(delay/1000)}s`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        return attemptPlayback();
                    }
                    
                    throw new Error('Failed to start video playback after multiple attempts');
                }
            };

            await attemptPlayback();

            // Set up ended handler
            const endedHandler = async () => {
                console.log('Dive-in video ended, transitioning to floor level');
                video.removeEventListener('ended', endedHandler);
                
                // Clean up video element
                video.pause();
                video.removeAttribute('src');
                video.load();
                video.remove();

                // Clean up transition view
                if (this.transitionView) {
                    while (this.transitionView.firstChild) {
                        this.transitionView.removeChild(this.transitionView.firstChild);
                    }
                    this.transitionView.style.display = 'none';
                }
                
                try {
                    await this.showFloorLevel(hotspotVideos, hotspotId);
                } catch (error) {
                    console.error('Error transitioning to floor level:', error);
                    this.updateStateIndicator('Error transitioning to floor level');
                    await this.showAerialView();
                }
            };

            video.addEventListener('ended', endedHandler);

        } catch (error) {
            console.error('Error during dive-in video playback:', error);
            this.updateStateIndicator('Error playing dive-in video');
            await this.showAerialView();
        }
    }
    
    async showFloorLevel(playlist, hotspotId) {
        try {
            console.log('Starting showFloorLevel with:', { playlist, hotspotId });
            
            // Hide house selector
            if (this.houseSelector) {
                this.houseSelector.style.display = 'none';
            }

            // Completely remove and recreate the floor level view container
            if (this.floorLevelView) {
                // Remove all existing content
                while (this.floorLevelView.firstChild) {
                    this.floorLevelView.removeChild(this.floorLevelView.firstChild);
                }

                // Create new container structure
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
                this.floorLevelView.appendChild(container);
            }

            // Update state indicator
            this.updateStateIndicator('Loading floor level video...');

            // Validate playlist data
            if (!playlist?.floorLevel?.videoId) {
                console.log('No floor level data in playlist, fetching from API...');
                const playlistResponse = await fetch(`/api/playlists?houseId=${this.currentHouse}&_=${Date.now()}`);
                if (!playlistResponse.ok) throw new Error('Failed to load playlist');
                const playlistData = await playlistResponse.json();
                playlist = playlistData.playlists[hotspotId];
                console.log('Fetched playlist data:', playlist);
            }

            if (!playlist?.floorLevel?.videoId) {
                console.warn('No floor level video assigned, returning to aerial view');
                this.returnToAerial();
                return;
            }

            // Get floor level video asset
            const assetsResponse = await fetch(`/api/assets?houseId=${this.currentHouse}&_=${Date.now()}`);
            if (!assetsResponse.ok) throw new Error('Failed to load assets');
            const assetsData = await assetsResponse.json();
            const floorLevelAsset = assetsData.assets.find(a => a._id === playlist.floorLevel.videoId);
            
            if (!floorLevelAsset) {
                console.warn('Floor level video not found in assets');
                this.returnToAerial();
                return;
            }

            console.log('Found floor level asset:', floorLevelAsset);

            // Get the new container and placeholder
            const videoContainer = this.floorLevelView.querySelector('.video-container');
            const videoPlaceholder = videoContainer.querySelector('.video-placeholder');

            // Create new video element
            const newFloorLevelVideo = document.createElement('video');
            newFloorLevelVideo.className = 'preview-video';
            newFloorLevelVideo.muted = false;
            newFloorLevelVideo.playsInline = true;
            newFloorLevelVideo.autoplay = true;
            newFloorLevelVideo.loop = false;
            newFloorLevelVideo.preload = 'auto';
            newFloorLevelVideo.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
            `;

            // Clear and update video placeholder
            videoPlaceholder.innerHTML = '';
            videoPlaceholder.appendChild(newFloorLevelVideo);

            // Add asset label
            const label = document.createElement('div');
            label.className = 'asset-label';
            label.textContent = `Floor Level Video: ${floorLevelAsset.name || 'Unnamed'}`;
            videoContainer.appendChild(label);

            // Show floor level view
            this.floorLevelView.style.display = 'block';
            console.log('Floor level view recreated and displayed');

            // Add event listeners
            const eventListeners = new Map();
            
            const addListener = (event, handler) => {
                newFloorLevelVideo.addEventListener(event, handler);
                eventListeners.set(event, handler);
                console.log(`Added ${event} listener to floor level video`);
            };

            addListener('loadstart', () => {
                console.log('Floor level video load started');
                this.updateStateIndicator('Loading floor level video...');
            });

            addListener('loadedmetadata', () => {
                console.log('Floor level video metadata loaded');
                this.updateStateIndicator('Floor level video metadata loaded...');
            });

            addListener('loadeddata', () => {
                console.log('Floor level video data loaded');
                this.updateStateIndicator('Floor level video data loaded...');
            });

            addListener('canplay', () => {
                console.log('Floor level video can play');
                this.updateStateIndicator('Floor level video ready to play...');
            });

            addListener('playing', () => {
                console.log('Floor level video is playing');
                this.updateStateIndicator('Playing floor level video...');
            });

            addListener('error', (e) => {
                console.error('Floor level video error:', e);
                this.updateStateIndicator('Error playing floor level video');
                console.error('Video error details:', {
                    code: newFloorLevelVideo.error?.code,
                    message: newFloorLevelVideo.error?.message,
                    src: newFloorLevelVideo.src,
                    readyState: newFloorLevelVideo.readyState,
                    networkState: newFloorLevelVideo.networkState
                });
            });

            // Handle video end
            addListener('ended', async () => {
                console.log('Floor level video ended, preparing zoom out transition');
                this.updateStateIndicator('Preparing zoom out transition...');
                
                // Clean up event listeners
                eventListeners.forEach((handler, event) => {
                    newFloorLevelVideo.removeEventListener(event, handler);
                });
                eventListeners.clear();

                // Clean up floor level video
                newFloorLevelVideo.pause();
                newFloorLevelVideo.removeAttribute('src');
                newFloorLevelVideo.load();
                newFloorLevelVideo.remove();

                // Clean up floor level view
                if (this.floorLevelView) {
                    while (this.floorLevelView.firstChild) {
                        this.floorLevelView.removeChild(this.floorLevelView.firstChild);
                    }
                    this.floorLevelView.style.display = 'none';
                }

                // Prepare zoom out video
                const zoomOutAsset = assetsData.assets.find(a => a._id === playlist.zoomOut.videoId);
                if (!zoomOutAsset) {
                    console.warn('Zoom out video not found');
                    this.returnToAerial();
                    return;
                }

                // Completely remove and recreate the transition view container
                if (this.transitionView) {
                    // Remove all existing content
                    while (this.transitionView.firstChild) {
                        this.transitionView.removeChild(this.transitionView.firstChild);
                    }

                    // Create new container structure
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
                    this.transitionView.appendChild(container);
                }

                // Get the new container and placeholder
                const transitionContainer = this.transitionView.querySelector('.video-container');
                const transitionPlaceholder = transitionContainer.querySelector('.video-placeholder');

                // Create zoom out video
                const zoomOutVideo = document.createElement('video');
                zoomOutVideo.className = 'preview-video';
                zoomOutVideo.muted = true;
                zoomOutVideo.playsInline = true;
                zoomOutVideo.autoplay = true;
                zoomOutVideo.loop = false;
                zoomOutVideo.preload = 'auto';
                zoomOutVideo.style.cssText = `
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                `;

                // Add video to placeholder
                transitionPlaceholder.appendChild(zoomOutVideo);

                // Add asset label
                const zoomOutLabel = document.createElement('div');
                zoomOutLabel.className = 'asset-label';
                zoomOutLabel.textContent = `Zoom Out Video: ${zoomOutAsset.name || 'Unnamed'}`;
                transitionContainer.appendChild(zoomOutLabel);

                // Show transition view
                this.transitionView.style.display = 'block';
                console.log('Transition view recreated and displayed');

                // Set source and load video
                zoomOutVideo.src = zoomOutAsset.url;
                zoomOutVideo.load();

                // Play zoom out video
                try {
                    await zoomOutVideo.play();
                    console.log('Playing zoom out video');
                    this.updateStateIndicator('Playing zoom out video...');
                } catch (error) {
                    console.error('Error playing zoom out video:', error);
                    this.returnToAerial();
                    return;
                }

                // Handle zoom out video end
                zoomOutVideo.onended = () => {
                    console.log('Zoom out video ended, returning to aerial view');
                    // Clean up zoom out video
                    zoomOutVideo.pause();
                    zoomOutVideo.removeAttribute('src');
                    zoomOutVideo.load();
                    zoomOutVideo.remove();
                    // Clean up transition view
                    if (this.transitionView) {
                        while (this.transitionView.firstChild) {
                            this.transitionView.removeChild(this.transitionView.firstChild);
                        }
                        this.transitionView.style.display = 'none';
                    }
                    this.returnToAerial();
                };
            });

            // Add playback clock
            const clock = this.createPlaybackClock(videoContainer);
            this.updatePlaybackClock(newFloorLevelVideo, clock);
            this.playbackClocks.set('floorLevel', clock);

            // Set source and load video
            this.updateStateIndicator('Loading floor level video...');
            newFloorLevelVideo.src = floorLevelAsset.url;
            newFloorLevelVideo.load();

            // Play floor level video
            try {
                await newFloorLevelVideo.play();
                console.log('Playing floor level video');
                this.updateStateIndicator('Playing floor level video...');
            } catch (error) {
                console.error('Error playing floor level video:', error);
                this.updateStateIndicator('Retrying floor level video playback...');
                setTimeout(async () => {
                    try {
                        await newFloorLevelVideo.play();
                        console.log('Playing floor level video after retry');
                        this.updateStateIndicator('Playing floor level video...');
                    } catch (retryError) {
                        console.error('Error playing floor level video after retry:', retryError);
                        this.updateStateIndicator('Error playing floor level video');
                        this.returnToAerial();
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('Error in showFloorLevel:', error);
            this.updateStateIndicator('Error loading floor level video');
            this.returnToAerial();
        }
    }

    returnToAerial() {
        console.log('Returning to aerial view');
        
        // Hide views
        if (this.transitionView) {
            this.transitionView.style.display = 'none';
            console.log('Transition view hidden');
        }
        if (this.floorLevelView) {
            this.floorLevelView.style.display = 'none';
            console.log('Floor level view hidden');
        }
        
        // Show aerial view
        if (this.aerialView) {
            this.aerialView.style.display = 'block';
            console.log('Aerial view displayed');
        }
        
        // Reset video states
        if (this.aerialVideo) {
            this.aerialVideo.currentTime = 0;
            this.aerialVideo.play().catch(error => {
                console.error('Error playing aerial video:', error);
                setTimeout(() => {
                    this.aerialVideo.play().catch(console.error);
                }, 1000);
            });
        }
        
        // Update state indicator
        this.updateStateIndicator('Current State: Aerial View');
        
        // Show house selector
        if (this.houseSelector) {
            this.houseSelector.style.display = 'block';
            console.log('House selector displayed');
        }
        
        // Reset current hotspot
        this.currentHotspot = null;
        
        // Clear playback clocks
        this.playbackClocks.forEach(clock => {
            if (clock && clock.parentNode) {
                clock.parentNode.removeChild(clock);
            }
        });
        this.playbackClocks.clear();
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
            const playlistResponse = await fetch(`/api/playlists?houseId=${this.currentHouse}&_=${Date.now()}`);
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
            const assetsResponse = await fetch(`/api/assets?houseId=${this.currentHouse}&_=${Date.now()}`);
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
        // Add a longer delay before resetting views
        setTimeout(() => {
            this.floorLevelView.style.display = 'none';
            this.transitionView.style.display = 'none';
            this.aerialView.style.display = 'block';
            this.aerialView.style.opacity = '0';
            this.aerialView.style.transition = 'opacity 0.5s ease';
            
            // Fade in aerial view
            setTimeout(() => {
                this.aerialView.style.opacity = '1';
            }, 50);
            
            // Update state indicator
            if (this.stateIndicator) {
                this.stateIndicator.textContent = 'Current State: Aerial View';
            }
            
            // Restore video state
            this.restoreVideoState();
        }, 3000); // Increased from 2000ms to 3000ms
    }

    async refreshAllData() {
        try {
            // Show loading state
            this.updateButton.textContent = 'Updating...';
            this.updateButton.disabled = true;

            // Clear preloaded videos
            this.preloadedVideos.clear();

            // Clear only the hotspots, preserving other elements
            const existingHotspots = this.hotspotContainer.querySelectorAll('.hotspot');
            existingHotspots.forEach(hotspot => hotspot.remove());

            // Reload all videos and assets
            await this.loadAssets();

            // Preload all videos again
            await this.preloadAllVideos();

            // Fetch and update hotspots
            const response = await fetch(`/api/hotspots?houseId=${this.currentHouse}&_=${Date.now()}`);
            if (!response.ok) throw new Error('Failed to load hotspots');
            const data = await response.json();
            
            if (data && data.hotspots) {
                // Update hotspots array and render them
                this.hotspots.clear();
                data.hotspots.forEach(hotspot => this.createHotspot(hotspot));
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
        if (this.isPreloading) {
            console.log('Waiting for videos to finish preloading...');
            await new Promise(resolve => {
                const checkPreloading = setInterval(() => {
                    if (!this.isPreloading) {
                        clearInterval(checkPreloading);
                        resolve();
                    }
                }, 100);
            });
        }

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
            const assetsResponse = await fetch(`/api/assets?houseId=${this.currentHouse}&_=${Date.now()}`);
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

            // Ensure transition view is ready but invisible
            this.transitionView.style.display = 'block';
            this.transitionView.style.opacity = '0';

            // Get the preloaded video or create a new one if not preloaded
            let newVideo = this.preloadedVideos.get(playlist.zoomOut.videoId);
            if (!newVideo) {
                console.log('Zoom out video not preloaded, creating new video element');
                newVideo = document.createElement('video');
                newVideo.className = 'preview-video';
                newVideo.muted = true;
                newVideo.playsInline = true;
                newVideo.autoplay = true;
                newVideo.loop = false;
                newVideo.src = zoomOutAsset.url;
                newVideo.preload = 'auto';
                
                // Wait for video to be ready
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Video load timeout'));
                    }, 10000);

                    const canPlayHandler = () => {
                        clearTimeout(timeout);
                        newVideo.removeEventListener('canplay', canPlayHandler);
                        resolve();
                    };
                    newVideo.addEventListener('canplay', canPlayHandler);
                    newVideo.load();
                });
            } else {
                // Reset the preloaded video
                newVideo.currentTime = 0;
                newVideo.className = 'preview-video';
                newVideo.muted = true;
                newVideo.playsInline = true;
                newVideo.autoplay = true;
                newVideo.loop = false;
            }

            // Clear and update video placeholder
            videoPlaceholder.innerHTML = '';
            videoPlaceholder.appendChild(newVideo);

            // Add asset label
            const label = document.createElement('div');
            label.className = 'asset-label';
            label.textContent = `Zoom Out Video: ${zoomOutAsset.name || 'Unnamed'}`;
            videoContainer.appendChild(label);

            // Add playback clock
            const existingClock = videoContainer.querySelector('.playback-clock');
            if (existingClock) {
                existingClock.remove();
            }
            const clock = this.createPlaybackClock(videoContainer);
            this.updatePlaybackClock(newVideo, clock);
            this.playbackClocks.set('zoomOut', clock);

            // Fade in transition view
            requestAnimationFrame(() => {
                this.transitionView.style.opacity = '1';
            });

            // Wait for fade in to complete before playing
            await new Promise(resolve => setTimeout(resolve, 500));

            // Reset and play the video
            newVideo.currentTime = 0;
            try {
                await newVideo.play();
                console.log('Playing zoom out video');
            } catch (error) {
                console.error('Error playing zoom out video:', error);
                if (error.name !== 'AbortError') {
                    setTimeout(async () => {
                        try {
                            await newVideo.play();
                            console.log('Playing zoom out video after retry');
                        } catch (retryError) {
                            console.error('Error playing zoom out video after retry:', retryError);
                            this.returnToAerial();
                        }
                    }, 1000);
                } else {
                    this.returnToAerial();
                }
            }

            // When zoom out video ends, return to aerial view with crossfade
            newVideo.onended = () => {
                console.log('Zoom out video ended, returning to aerial view');
                // Start crossfade to aerial view
                if (this.aerialVideo) {
                    // Ensure aerial view is visible but transparent
                    this.aerialView.style.display = 'block';
                    this.aerialView.style.opacity = '0';
                    this.aerialVideo.style.opacity = '0';
                    
                    // Start playing aerial video before transition
                    this.aerialVideo.play().catch(console.error);
                    
                    // Fade in aerial view
                    requestAnimationFrame(() => {
                        this.aerialView.style.opacity = '1';
                        this.aerialVideo.style.opacity = '1';
                        
                        // Hide transition view after fade
                        setTimeout(() => {
                            this.transitionView.style.display = 'none';
                            this.floorLevelView.style.display = 'none';
                            // Show house selector after transition is complete
                            if (this.houseSelector) {
                                this.houseSelector.style.display = 'block';
                            }
                        }, 1000);
                    });
                } else {
                    this.returnToAerial();
                }
            };
        } catch (error) {
            console.error('Error in playZoomOutVideo:', error);
            this.returnToAerial();
        }
    }

    // Create a hotspot element
    createHotspot(hotspot) {
        console.log('Creating hotspot:', hotspot);
        
        // Create SVG element for the hotspot
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.pointerEvents = 'all';

        // Create polygon for the hotspot
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        
        // Convert points to SVG polygon points string
        if (hotspot.points && Array.isArray(hotspot.points)) {
            const pointsString = hotspot.points.map(point => {
                // Handle both object format {x, y} and array format [x, y]
                const x = typeof point === 'object' ? point.x : point[0];
                const y = typeof point === 'object' ? point.y : point[1];
                return `${x},${y}`;
            }).join(' ');
            
            console.log('Setting polygon points:', pointsString);
            polygon.setAttribute('points', pointsString);
        } else {
            console.error('Invalid points data:', hotspot.points);
            return;
        }

        // Set polygon attributes
        polygon.setAttribute('fill', 'rgba(229, 9, 20, 0)');
        polygon.setAttribute('stroke', 'none');
        polygon.setAttribute('stroke-width', '0');
        polygon.setAttribute('data-hotspot-id', hotspot._id);
        polygon.setAttribute('data-type', hotspot.type);
        polygon.setAttribute('title', hotspot.title || '');

        // Add hover effects
        polygon.addEventListener('mouseover', () => {
            polygon.setAttribute('fill', 'rgba(229, 9, 20, 0.4)');
        });

        polygon.addEventListener('mouseout', () => {
            polygon.setAttribute('fill', 'rgba(229, 9, 20, 0)');
        });

        // Add click handler
        polygon.addEventListener('click', () => {
            console.log('Hotspot clicked:', hotspot);
            this.handleHotspotClick(hotspot);
        });

        // Add polygon to SVG
        svg.appendChild(polygon);
        
        // Store hotspot reference
        this.hotspots.set(hotspot._id, { element: svg, data: hotspot });
        
        // Add SVG to container
        if (this.hotspotContainer) {
            this.hotspotContainer.appendChild(svg);
            console.log('Hotspot created and added to container');
        } else {
            console.error('Hotspot container not found');
        }
    }

    // Clear all hotspots
    clearHotspots() {
        console.log('Clearing all hotspots');
        if (this.hotspotContainer) {
            this.hotspotContainer.innerHTML = '';
            this.hotspots.clear();
        }
    }

    // Add new method to preload videos
    async initializeAndPreload() {
        try {
            this.isPreloading = true;
            this.stateIndicator.textContent = 'Loading videos...';
            
            // Create loading overlay
            const loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'loadingOverlay';
            loadingOverlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                color: white;
            `;
            
            const progressBar = document.createElement('div');
            progressBar.style.cssText = `
                width: 80%;
                max-width: 400px;
                height: 20px;
                background: #333;
                border-radius: 10px;
                margin: 20px 0;
                overflow: hidden;
            `;
            
            const progressFill = document.createElement('div');
            progressFill.style.cssText = `
                width: 0%;
                height: 100%;
                background: #e50914;
                transition: width 0.3s ease;
            `;
            
            const statusText = document.createElement('div');
            statusText.style.cssText = `
                margin-top: 10px;
                font-size: 14px;
                color: #ccc;
            `;
            statusText.textContent = 'Loading videos...';
            
            progressBar.appendChild(progressFill);
            loadingOverlay.appendChild(progressBar);
            loadingOverlay.appendChild(statusText);
            document.body.appendChild(loadingOverlay);

            // Start preloading
            await this.preloadAllVideos((progress) => {
                progressFill.style.width = `${progress}%`;
                statusText.textContent = `Loading videos... ${Math.round(progress)}%`;
            });

            // Remove loading overlay
            loadingOverlay.remove();
            this.isPreloading = false;
            this.stateIndicator.textContent = 'Current State: Aerial View';
            
            // Start aerial video playback using safe play
            if (this.aerialVideo) {
                try {
                    await this.safePlay(this.aerialVideo);
                } catch (error) {
                    console.error('Error playing aerial video:', error);
                    // Try one more time after a short delay
                    setTimeout(async () => {
                        try {
                            await this.safePlay(this.aerialVideo);
                        } catch (retryError) {
                            console.error('Error playing aerial video after retry:', retryError);
                        }
                    }, 1000);
                }
            }
        } catch (error) {
            console.error('Error during initialization:', error);
            this.stateIndicator.textContent = 'Error loading videos - some videos may load on demand';
            // Continue initialization even if there are errors
            this.isPreloading = false;
            
            // Try to start aerial video anyway using safe play
            if (this.aerialVideo) {
                try {
                    await this.safePlay(this.aerialVideo);
                } catch (playError) {
                    console.error('Error playing aerial video:', playError);
                }
            }
        }
    }

    // Modify preloadAllVideos to handle large files better
    async preloadAllVideos(progressCallback) {
        try {
            console.log('Starting video preload...');
            
            // Load all assets first
            const assetsResponse = await fetch(`/api/assets?houseId=${this.currentHouse}&_=${Date.now()}`);
            if (!assetsResponse.ok) throw new Error('Failed to load assets');
            const { assets } = await assetsResponse.json();
            
            const videosResponse = await fetch(`/api/hotspot-videos?houseId=${this.currentHouse}&_=${Date.now()}`);
            if (!videosResponse.ok) throw new Error('Failed to load hotspot videos');
            const { hotspotVideos } = await videosResponse.json();

            // Create a Set of all video IDs we need to preload
            const videoIds = new Set();
            
            // Add aerial video first (highest priority)
            const houseVideosResponse = await fetch(`/api/house-videos?houseId=${this.currentHouse}&_=${Date.now()}`);
            if (houseVideosResponse.ok) {
                const { houseVideo } = await houseVideosResponse.json();
                if (houseVideo?.aerial?.videoId) {
                    videoIds.add(houseVideo.aerial.videoId);
                }
            }

            // Add all hotspot videos
            if (Array.isArray(hotspotVideos)) {
                hotspotVideos.forEach(hotspot => {
                    if (hotspot.diveIn?.videoId) videoIds.add(hotspot.diveIn.videoId);
                    if (hotspot.floorLevel?.videoId) videoIds.add(hotspot.floorLevel.videoId);
                    if (hotspot.zoomOut?.videoId) videoIds.add(hotspot.zoomOut.videoId);
                });
            }

            // Add global videos
            const globalVideosResponse = await fetch(`/api/global-videos?_=${Date.now()}`);
            if (globalVideosResponse.ok) {
                const { globalVideos } = await globalVideosResponse.json();
                Object.values(globalVideos).forEach(video => {
                    if (video?.videoId) videoIds.add(video.videoId);
                });
            }

            console.log('Videos to preload:', Array.from(videoIds));
            this.totalVideosToPreload = videoIds.size;
            this.loadedVideos = 0;

            // Convert Set to Array and prioritize aerial video
            const videoIdsArray = Array.from(videoIds);
            const aerialVideoId = videoIdsArray.find(id => {
                const asset = assets.find(a => a._id === id);
                return asset?.name?.toLowerCase().includes('aerial');
            });
            
            if (aerialVideoId) {
                // Move aerial video to front of array
                const index = videoIdsArray.indexOf(aerialVideoId);
                videoIdsArray.splice(index, 1);
                videoIdsArray.unshift(aerialVideoId);
            }

            // Preload videos in batches to prevent overwhelming the browser
            const batchSize = 2; // Load 2 videos at a time
            for (let i = 0; i < videoIdsArray.length; i += batchSize) {
                const batch = videoIdsArray.slice(i, i + batchSize);
                const batchPromises = batch.map(videoId => this.preloadVideo(videoId, assets, progressCallback));
                await Promise.all(batchPromises);
            }

            console.log('Video preload completed. Successfully preloaded:', this.preloadedVideos.size, 'of', this.totalVideosToPreload, 'videos');
            
        } catch (error) {
            console.error('Error during video preload:', error);
            // Don't throw the error - allow initialization to continue
            // Videos will be loaded on demand if preloading failed
        }
    }

    // New method to handle individual video preloading
    async preloadVideo(videoId, assets, progressCallback) {
        const asset = assets.find(a => a._id === videoId);
        if (!asset) {
            console.warn(`Asset not found for video ID: ${videoId}`);
            this.loadedVideos++;
            if (progressCallback) {
                progressCallback((this.loadedVideos / this.totalVideosToPreload) * 100);
            }
            return;
        }

        return new Promise((resolve) => {
            let retryCount = 0;
            const maxRetries = 5; // Increased from 3 to 5
            const baseRetryDelay = 2000;
            const maxRetryDelay = 15000; // Increased from 10000 to 15000

            const getRetryDelay = (attempt) => {
                const delay = Math.min(baseRetryDelay * Math.pow(2, attempt), maxRetryDelay);
                // Add more jitter to prevent thundering herd
                return delay + Math.random() * 2000;
            };

            const attemptPreload = () => {
                console.log(`Attempting to preload video ${asset.name || videoId} (attempt ${retryCount + 1}/${maxRetries})`);
                
                const video = document.createElement('video');
                video.preload = 'auto'; // Changed from 'metadata' to 'auto'
                video.muted = true;
                video.playsInline = true;
                video.crossOrigin = 'anonymous';
         
                let loadTimeout;
                let canPlayTimeout;
                let stalledTimeout;
                let isResolved = false;
                let isStalled = false;
                let hasLoadedMetadata = false;
                let hasLoadedData = false;
                let hasCanPlay = false;
                let lastProgressTime = Date.now();
                let noProgressTimeout;

                const cleanup = () => {
                    if (isResolved) return;
                    clearTimeout(loadTimeout);
                    clearTimeout(canPlayTimeout);
                    clearTimeout(stalledTimeout);
                    clearTimeout(noProgressTimeout);
                    video.removeEventListener('loadedmetadata', loadHandler);
                    video.removeEventListener('loadeddata', dataHandler);
                    video.removeEventListener('canplay', canPlayHandler);
                    video.removeEventListener('error', errorHandler);
                    video.removeEventListener('stalled', stalledHandler);
                    video.removeEventListener('progress', progressHandler);
                    video.removeAttribute('src');
                    video.load();
                };

                const dataHandler = () => {
                    if (isResolved) return;
                    console.log(`Loaded data for video: ${asset.name || videoId}`);
                    hasLoadedData = true;
                    checkReady();
                };

                const loadHandler = () => {
                    if (isResolved) return;
                    console.log(`Loaded metadata for video: ${asset.name || videoId}`);
                    hasLoadedMetadata = true;
                    checkReady();
                };

                const checkReady = () => {
                    if (isResolved) return;
                    
                    // Only consider the video ready when we have both metadata and data
                    if (hasLoadedMetadata && hasLoadedData && hasCanPlay) {
                        console.log(`Video fully ready: ${asset.name || videoId}`);
                        
                        // Store the video in preloaded cache
                        this.preloadedVideos.set(videoId, video);
                        
                        this.loadedVideos++;
                        if (progressCallback) {
                            progressCallback((this.loadedVideos / this.totalVideosToPreload) * 100);
                        }
                        isResolved = true;
                        cleanup();
                        resolve();
                    }
                };

                const progressHandler = () => {
                    if (isStalled) {
                        console.log(`Video ${asset.name || videoId} resumed loading`);
                        isStalled = false;
                        clearTimeout(stalledTimeout);
                        clearTimeout(noProgressTimeout);
                    }
                    lastProgressTime = Date.now();
                };

                const canPlayHandler = () => {
                    if (isResolved) return;
                    console.log(`Video can play: ${asset.name || videoId}`);
                    hasCanPlay = true;
                    clearTimeout(canPlayTimeout);
                    checkReady();
                };

                const stalledHandler = () => {
                    if (isResolved || isStalled) return;
                    
                    console.warn(`Video stalled during loading: ${asset.name || videoId}`);
                    isStalled = true;
                    
                    // Check for no progress
                    noProgressTimeout = setTimeout(() => {
                        if (!isResolved && Date.now() - lastProgressTime > 10000) {
                            console.warn(`No progress for 10s on stalled video: ${asset.name || videoId}`);
                            cleanup();
                            errorHandler(new Error('No progress on stalled video'));
                        }
                    }, 10000);

                    // Increased stalled timeout
                    stalledTimeout = setTimeout(() => {
                        if (!isResolved) {
                            console.warn(`Video still stalled after timeout: ${asset.name || videoId}`);
                            cleanup();
                            errorHandler(new Error('Video stalled during loading'));
                        }
                    }, 15000); // Increased from 10000 to 15000
                };

                const errorHandler = (e) => {
                    if (isResolved) return;
                    console.warn(`Error preloading video ${asset.name || videoId}:`, e);
                    cleanup();

                    if (retryCount < maxRetries) {
                        retryCount++;
                        const delay = getRetryDelay(retryCount);
                        console.log(`Retrying preload for ${asset.name || videoId} in ${Math.round(delay/1000)}s (attempt ${retryCount + 1}/${maxRetries})`);
                        setTimeout(attemptPreload, delay);
                    } else {
                        console.warn(`Failed to preload video ${asset.name || videoId} after ${maxRetries} attempts. Will load on demand.`);
                        this.loadedVideos++;
                        if (progressCallback) {
                            progressCallback((this.loadedVideos / this.totalVideosToPreload) * 100);
                        }
                        isResolved = true;
                        resolve();
                    }
                };

                // Increased timeouts
                loadTimeout = setTimeout(() => {
                    if (!isResolved) {
                        console.warn(`Timeout loading video ${asset.name || videoId}`);
                        cleanup();
                        errorHandler(new Error('Load timeout'));
                    }
                }, 90000); // Increased from 60000 to 90000

                canPlayTimeout = setTimeout(() => {
                    if (!isResolved) {
                        console.warn(`Timeout waiting for canplay for ${asset.name || videoId}`);
                        cleanup();
                        errorHandler(new Error('Canplay timeout'));
                    }
                }, 120000); // Increased from 90000 to 120000

                // Add event listeners
                video.addEventListener('loadedmetadata', loadHandler);
                video.addEventListener('loadeddata', dataHandler);
                video.addEventListener('canplay', canPlayHandler);
                video.addEventListener('error', errorHandler);
                video.addEventListener('stalled', stalledHandler);
                video.addEventListener('progress', progressHandler);

                // Start loading
                try {
                    console.log(`Setting source for video ${asset.name || videoId}`);
                    video.src = asset.url;
                    video.load();
                } catch (error) {
                    console.warn(`Error setting video source for ${asset.name || videoId}:`, error);
                    cleanup();
                    errorHandler(error);
                }
            };

            // Start first preload attempt
            attemptPreload();
        });
    }

    async fetchVideosForHotspot(hotspotId) {
        try {
            console.log('Fetching videos for hotspot:', hotspotId);
            const videosUrl = `/api/hotspot-videos?houseId=${this.currentHouse}&hotspotId=${hotspotId}&_=${Date.now()}`;
            console.log('Fetching videos from URL:', videosUrl);
            
            const videosResponse = await fetch(videosUrl);
            if (!videosResponse.ok) {
                console.error('Failed to load hotspot videos. Status:', videosResponse.status);
                return null;
            }
            
            const videosData = await videosResponse.json();
            console.log('Received videos data:', JSON.stringify(videosData, null, 2));
            
            const { hotspotVideos } = videosData;
            if (!hotspotVideos) {
                console.error('No videos data in response');
                return null;
            }

            // Get the dive-in video asset
            if (hotspotVideos.diveIn?.videoId) {
                const diveInAsset = this.assets.find(a => a._id === hotspotVideos.diveIn.videoId);
                if (!diveInAsset) {
                    console.error('Dive-in video not found in assets:', hotspotVideos.diveIn.videoId);
                    return null;
                }
                hotspotVideos.diveIn = { ...hotspotVideos.diveIn, ...diveInAsset };
            }

            // Get the floor level video asset
            if (hotspotVideos.floorLevel?.videoId) {
                const floorLevelAsset = this.assets.find(a => a._id === hotspotVideos.floorLevel.videoId);
                if (floorLevelAsset) {
                    hotspotVideos.floorLevel = { ...hotspotVideos.floorLevel, ...floorLevelAsset };
                }
            }

            // Get the zoom out video asset
            if (hotspotVideos.zoomOut?.videoId) {
                const zoomOutAsset = this.assets.find(a => a._id === hotspotVideos.zoomOut.videoId);
                if (zoomOutAsset) {
                    hotspotVideos.zoomOut = { ...hotspotVideos.zoomOut, ...zoomOutAsset };
                }
            }

            return hotspotVideos;
        } catch (error) {
            console.error('Error fetching videos for hotspot:', error);
            return null;
        }
    }

    updateStateIndicator(message) {
        if (this.stateIndicator) {
            this.stateIndicator.textContent = message;
        } else {
            console.warn('State indicator element not found');
        }
    }

    async showAerialView() {
        try {
            // Hide all other views
            if (this.transitionView) this.transitionView.style.display = 'none';
            if (this.floorLevelView) this.floorLevelView.style.display = 'none';
            
            // Show aerial view
            if (this.aerialView) {
                this.aerialView.style.display = 'block';
                // Ensure aerial video is playing
                if (this.aerialVideo) {
                    try {
                        await this.aerialVideo.play();
                    } catch (error) {
                        console.error('Error playing aerial video:', error);
                        // Try one more time after a short delay
                        setTimeout(async () => {
                            try {
                                await this.aerialVideo.play();
                            } catch (retryError) {
                                console.error('Error playing aerial video after retry:', retryError);
                            }
                        }, 1000);
                    }
                }
            }
            
            // Show house selector
            if (this.houseSelector) {
                this.houseSelector.style.display = 'block';
            }
            
            // Update state indicator
            this.updateStateIndicator('Current State: Aerial View');
            
            // Reset current hotspot
            this.currentHotspot = null;
        } catch (error) {
            console.error('Error showing aerial view:', error);
        }
    }

    // Add new method to safely play video
    async safePlay(video) {
        if (!video) return;
        
        // If we're already playing, don't try to play again
        if (this.isPlaying) return;
        
        // If there's an ongoing play operation, wait for it
        if (this.playPromise) {
            try {
                await this.playPromise;
            } catch (error) {
                console.warn('Previous play operation failed:', error);
            }
        }
        
        try {
            this.isPlaying = true;
            this.playPromise = video.play();
            await this.playPromise;
        } catch (error) {
            console.error('Error playing video:', error);
            this.isPlaying = false;
            this.playPromise = null;
            throw error;
        } finally {
            if (this.playPromise === video.play()) {
                this.playPromise = null;
            }
        }
    }

    // Add new method to safely pause video
    async safePause(video) {
        if (!video) return;
        
        // If we're not playing, nothing to pause
        if (!this.isPlaying) return;
        
        // If there's an ongoing play operation, wait for it
        if (this.playPromise) {
            try {
                await this.playPromise;
            } catch (error) {
                console.warn('Previous play operation failed:', error);
            }
        }
        
        try {
            video.pause();
            this.isPlaying = false;
            this.playPromise = null;
        } catch (error) {
            console.error('Error pausing video:', error);
            throw error;
        }
    }
}

// Update the initialization to prevent multiple instances
if (!window.hotspotManager) {
    window.hotspotManager = new HotspotManager();
}