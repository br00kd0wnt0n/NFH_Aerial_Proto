// Global state management
let currentHouseId = '1'; // Default to house 1
let isInitialized = false;

// Loading status management
const LoadingStatus = {
    HOTSPOT_MANAGER: 'Initializing Hotspot Manager...',
    VIDEO_ELEMENTS: 'Setting up video elements...',
    HOUSE_SELECTOR: 'Initializing house selector...',
    LOADING_ASSETS: 'Loading house assets...',
    LOADING_PLAYLISTS: 'Loading playlists...',
    LOADING_HOTSPOTS: 'Loading hotspots...',
    VERIFYING_VIDEOS: 'Verifying video elements...',
    COMPLETE: 'Initialization complete!'
};

function updateLoadingStatus(status, progress = null) {
    const loadingText = document.querySelector('#loadingStatus');
    if (loadingText) {
        loadingText.textContent = status;
        if (progress !== null) {
            const progressBar = document.querySelector('#loadingProgress');
            if (progressBar) {
                progressBar.style.width = `${progress}%`;
            }
        }
    }
    console.log(`[DEBUG] Loading Status: ${status}${progress !== null ? ` (${progress}%)` : ''}`);
}

// House selection handling
function initializeHouseSelector() {
    console.log('Initializing house selector...');
    const houseButtons = document.querySelectorAll('.house-btn');
    console.log('Found house buttons:', houseButtons.length);
    
    // Set initial active state
    houseButtons.forEach(btn => {
        const houseId = btn.dataset.houseId;
        console.log('Button house ID:', houseId);
        if (houseId === currentHouseId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }

        // Add click handler
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('House button clicked:', houseId);
            
            if (houseId !== currentHouseId) {
                // Update active state
                houseButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update house and reload content
                currentHouseId = houseId;
                await loadHouseContent(houseId);
            }
        });
    });
}

// Loading sequence
async function initializeApplication() {
    try {
        console.log('[DEBUG] Starting application initialization...');
        
        // Create loading overlay with more detailed status
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
            font-family: Arial, sans-serif;
        `;
        
        // Add logo
        const logo = document.createElement('img');
        logo.src = '/images/NH_temp_Logo.png';
        logo.style.cssText = `
            width: 200px;
            margin-bottom: 30px;
        `;
        
        // Add loading container
        const loadingContainer = document.createElement('div');
        loadingContainer.style.cssText = `
            width: 300px;
            text-align: center;
        `;
        
        // Add status text
        const loadingText = document.createElement('div');
        loadingText.id = 'loadingStatus';
        loadingText.textContent = LoadingStatus.HOTSPOT_MANAGER;
        loadingText.style.cssText = `
            margin-bottom: 20px;
            font-size: 16px;
            color: #fff;
        `;
        
        // Add progress bar container
        const progressContainer = document.createElement('div');
        progressContainer.style.cssText = `
            width: 100%;
            height: 4px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
            margin-bottom: 20px;
            overflow: hidden;
        `;
        
        // Add progress bar
        const progressBar = document.createElement('div');
        progressBar.id = 'loadingProgress';
        progressBar.style.cssText = `
            width: 0%;
            height: 100%;
            background: #e50914;
            transition: width 0.3s ease-out;
        `;
        
        // Add loading spinner
        const loadingSpinner = document.createElement('div');
        loadingSpinner.style.cssText = `
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255, 255, 255, 0.1);
            border-top: 3px solid #e50914;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        `;
        
        // Add style for spinner animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        
        // Assemble loading overlay
        document.head.appendChild(style);
        progressContainer.appendChild(progressBar);
        loadingContainer.appendChild(loadingText);
        loadingContainer.appendChild(progressContainer);
        loadingContainer.appendChild(loadingSpinner);
        loadingOverlay.appendChild(logo);
        loadingOverlay.appendChild(loadingContainer);
        document.body.appendChild(loadingOverlay);
        
        // Initialize HotspotManager
        updateLoadingStatus(LoadingStatus.HOTSPOT_MANAGER, 10);
        console.log('[DEBUG] Initializing HotspotManager...');
        if (!window.hotspotManager) {
            throw new Error('HotspotManager not found');
        }
        
        // Wait for HotspotManager to be fully initialized
        await new Promise((resolve) => {
            const checkInitialization = () => {
                const manager = window.hotspotManager;
                if (manager && 
                    manager.aerialVideo && 
                    manager.transitionVideo && 
                    manager.floorLevelVideo && 
                    manager.aerialView && 
                    manager.transitionView && 
                    manager.floorLevelView) {
                    updateLoadingStatus(LoadingStatus.VIDEO_ELEMENTS, 30);
                    resolve();
                } else {
                    setTimeout(checkInitialization, 100);
                }
            };
            checkInitialization();
        });
        
        // Initialize house selector
        updateLoadingStatus(LoadingStatus.HOUSE_SELECTOR, 40);
        console.log('[DEBUG] Initializing house selector...');
        initializeHouseSelector();
        
        // Load initial content without waiting for isInitialized
        updateLoadingStatus(LoadingStatus.LOADING_ASSETS, 50);
        console.log('[DEBUG] Loading initial house content...');
        
        // Get the hotspot manager instance
        const hotspotManager = window.hotspotManager;
        if (!hotspotManager) {
            throw new Error('Hotspot manager not initialized');
        }

        // Load assets with progress updates
        updateLoadingStatus(LoadingStatus.LOADING_PLAYLISTS, 60);
        console.log('[DEBUG] Loading playlists...');
        await hotspotManager.loadAssets();
        
        updateLoadingStatus(LoadingStatus.LOADING_HOTSPOTS, 70);
        console.log('[DEBUG] Loading hotspots...');
        await hotspotManager.loadHotspots();
        
        // Verify only the aerial video is ready during initial load
        updateLoadingStatus(LoadingStatus.VERIFYING_VIDEOS, 80);
        const manager = window.hotspotManager;
        
        // Only verify aerial video during initial load
        if (manager.aerialVideo) {
            console.log('[DEBUG] Verifying aerial video...');
            // Wait for aerial video to be ready
            if (manager.aerialVideo.readyState < 2) { // HAVE_CURRENT_DATA
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        console.log('[DEBUG] Initial video load timeout, but continuing initialization...');
                        // Instead of rejecting, we'll resolve and let the video load in the background
                        resolve();
                    }, 15000); // Increased timeout to 15 seconds

                    const canPlayHandler = () => {
                        console.log('[DEBUG] Aerial video can play');
                        clearTimeout(timeout);
                        resolve();
                    };

                    const errorHandler = (e) => {
                        console.error('[DEBUG] Aerial video error:', e);
                        clearTimeout(timeout);
                        reject(new Error(`Aerial video error: ${e.message}`));
                    };

                    // Add event listeners
                    manager.aerialVideo.addEventListener('canplay', canPlayHandler, { once: true });
                    manager.aerialVideo.addEventListener('error', errorHandler, { once: true });

                    // Also check if video is already ready
                    if (manager.aerialVideo.readyState >= 2) {
                        console.log('[DEBUG] Aerial video already ready');
                        clearTimeout(timeout);
                        resolve();
                    }
                });
            }
            console.log('[DEBUG] Aerial video verified');
        } else {
            throw new Error('Aerial video not initialized');
        }
        
        // Mark as initialized
        isInitialized = true;
        updateLoadingStatus(LoadingStatus.COMPLETE, 100);
        console.log('[DEBUG] Application initialization complete');
        
        // Remove loading overlay with fade
        loadingOverlay.style.transition = 'opacity 0.5s ease-out';
        loadingOverlay.style.opacity = '0';
        setTimeout(() => loadingOverlay.remove(), 500);
        
    } catch (error) {
        console.error('[DEBUG] Error during initialization:', error);
        // Show error state with more details
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.innerHTML = `
                <div style="color: #e50914; text-align: center; padding: 20px;">
                    <img src="/images/NH_temp_Logo.png" style="width: 200px; margin-bottom: 30px;">
                    <h2 style="margin-bottom: 20px;">Error Initializing Application</h2>
                    <p style="margin-bottom: 20px; color: #fff;">${error.message}</p>
                    <div style="margin-bottom: 20px; color: #fff;">
                        <p>Please check the following:</p>
                        <ul style="text-align: left; display: inline-block;">
                            <li>All required video files are available</li>
                            <li>Your internet connection is stable</li>
                            <li>The server is running properly</li>
                            <li>Video files are properly encoded</li>
                        </ul>
                    </div>
                    <button onclick="location.reload()" style="
                        padding: 12px 24px;
                        background: #e50914;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 16px;
                        transition: background 0.3s ease;
                    " onmouseover="this.style.background='#f40612'" 
                      onmouseout="this.style.background='#e50914'">Retry</button>
                </div>
            `;
        }
    }
}

// Update house content loading
async function loadHouseContent(houseId) {
    // Only check initialization for subsequent house switches
    if (isInitialized) {
        console.log('[DEBUG] Checking initialization state...');
        const manager = window.hotspotManager;
        if (!manager || !manager.aerialVideo || !manager.transitionVideo || !manager.aerialView || !manager.transitionView) {
            console.error('[DEBUG] Required video elements not found:', {
                transitionView: !!manager?.transitionView,
                aerialView: !!manager?.aerialView,
                transitionVideo: !!manager?.transitionVideo
            });
            throw new Error('Required video elements not found');
        }
    }

    const oldHouseId = parseInt(currentHouseId);
    console.log('[DEBUG] Loading house content:', { oldHouseId, newHouseId: houseId });

    // If we're actually switching houses (not initial load), play transition video
    if (oldHouseId !== parseInt(houseId)) {
        try {
            console.log('[DEBUG] Switching houses, attempting to play transition video');
            
            // Get global videos
            const globalVideosResponse = await fetch(`/api/global-videos?_=${Date.now()}`);
            if (!globalVideosResponse.ok) throw new Error('Failed to load global videos');
            const { globalVideos } = await globalVideosResponse.json();
            console.log('[DEBUG] Loaded global videos:', globalVideos);

            // Determine which transition video to play
            const transitionKey = oldHouseId === 1 ? 'transitionKopToDallas' : 'transitionDallasToKop';
            console.log('[DEBUG] Using transition key:', transitionKey);
            const transitionVideoId = globalVideos[transitionKey]?.videoId;
            console.log('[DEBUG] Transition video ID:', transitionVideoId);

            if (!transitionVideoId) {
                console.log('[DEBUG] No transition video found, skipping transition');
                // Skip transition and load new house directly
                await loadNewHouse(houseId);
                return;
            }

            // Get the transition video asset
            const assetsResponse = await fetch(`/api/assets?houseId=${oldHouseId}&_=${Date.now()}`);
            if (!assetsResponse.ok) throw new Error('Failed to load assets');
            const assetsData = await assetsResponse.json();
            const transitionAsset = assetsData.assets.find(a => a._id === transitionVideoId);

            if (!transitionAsset) {
                console.error('[DEBUG] Transition video asset not found:', transitionVideoId);
                throw new Error('Transition video asset not found');
            }

            // Play transition video
            const manager = window.hotspotManager;
            if (!manager) throw new Error('Hotspot manager not initialized');

            // Show transition view and play video
            manager.transitionView.style.display = 'block';
            manager.aerialView.style.display = 'none';
            manager.floorLevelView.style.display = 'none';

            const transitionVideo = manager.transitionVideo;
            transitionVideo.src = transitionAsset.url;
            transitionVideo.loop = false;
            transitionVideo.muted = true;
            transitionVideo.playsInline = true;
            transitionVideo.autoplay = true;

            // Wait for transition video to end
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    console.log('[DEBUG] Transition video timeout, proceeding to new house');
                    resolve();
                }, 10000); // 10 second timeout

                transitionVideo.onended = () => {
                    clearTimeout(timeout);
                    console.log('[DEBUG] Transition video ended');
                    resolve();
                };

                transitionVideo.onerror = (error) => {
                    clearTimeout(timeout);
                    console.error('[DEBUG] Transition video error:', error);
                    reject(new Error('Transition video failed to play'));
                };
            });

            // Load new house after transition
            await loadNewHouse(houseId);
        } catch (error) {
            console.error('[DEBUG] Error during house transition:', error);
            // If transition fails, try to load new house directly
            await loadNewHouse(houseId);
        }
    } else {
        // Initial load or same house, just load content
        await loadNewHouse(houseId);
    }
}

// Add the missing loadNewHouse function
async function loadNewHouse(houseId) {
    console.log('[DEBUG] Loading new house:', houseId);
    const manager = window.hotspotManager;
    if (!manager) {
        throw new Error('Hotspot manager not initialized');
    }

    try {
        // Update current house ID
        currentHouseId = houseId.toString();
        manager.currentHouse = parseInt(houseId);

        // Load new assets and hotspots
        await manager.loadAssets();
        await manager.loadHotspots();

        // Show aerial view
        manager.transitionView.style.display = 'none';
        manager.aerialView.style.display = 'block';
        manager.floorLevelView.style.display = 'none';

        // Reset any active hotspots
        manager.currentHotspot = null;
        manager.stateIndicator.textContent = 'Current State: Aerial View';

        console.log('[DEBUG] New house loaded successfully');
    } catch (error) {
        console.error('[DEBUG] Error loading new house:', error);
        throw error;
    }
}

// Create hotspot element
function createHotspot(hotspot) {
    const container = document.getElementById('hotspotContainer');
    if (!container) return;

    const hotspotElement = document.createElement('div');
    hotspotElement.className = `hotspot ${hotspot.type}`;
    hotspotElement.dataset.hotspotId = hotspot._id;
    hotspotElement.dataset.type = hotspot.type;
    hotspotElement.title = hotspot.title;
    
    // Position the hotspot
    if (hotspot.points && hotspot.points.length > 0) {
        const [x, y] = hotspot.points[0];
        hotspotElement.style.left = `${x}%`;
        hotspotElement.style.top = `${y}%`;
    }
    
    // Add click handler
    hotspotElement.addEventListener('click', () => {
        console.log('Hotspot clicked:', hotspot);
        // Handle hotspot click
    });
    
    container.appendChild(hotspotElement);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting initialization...');
    initializeApplication();
}); 