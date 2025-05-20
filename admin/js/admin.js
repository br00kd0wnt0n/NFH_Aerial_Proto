// Admin Panel JavaScript
document.addEventListener('DOMContentLoaded', async () => {
    // Navigation
    const navButtons = document.querySelectorAll('[data-section]');
    const sections = document.querySelectorAll('.content-section');
    const applyChangesBtn = document.getElementById('applyChangesBtn');
    const uploadToastElement = document.getElementById('uploadToast');
    const uploadToast = new bootstrap.Toast(uploadToastElement);
    
    // Initialize toast for notifications
    const notificationToast = new bootstrap.Toast(document.getElementById('notificationToast'));
    
    // Show notification function
    function showNotification(message, type = 'success') {
        const toastElement = document.getElementById('notificationToast');
        if (!toastElement) return;

        const toastBody = toastElement.querySelector('.toast-body');
        if (toastBody) {
            toastBody.textContent = message;
        }

        // Update toast header based on type
        const toastHeader = toastElement.querySelector('.toast-header strong');
        if (toastHeader) {
            toastHeader.textContent = type === 'error' ? 'Error' : 'Success';
        }

        // Show the toast
        const toast = new bootstrap.Toast(toastElement);
        toast.show();
    }
    
    // Global variables
    let currentHouse = 1; // Default house ID for hotspots
    let currentAssetHouse = 1; // Separate house ID for assets
    let currentPlaylistHouse = 1; // Separate house ID for playlists
    let editingHotspotId = null;
    let assetTypes = null;
    let assets = []; // Add global assets array
    let isInitializing = false; // Add flag to prevent concurrent initialization
    let currentGlobalVideos = null; // Add variable to store current global videos state

    // Initialize DOM elements
    const hotspotModal = document.getElementById('hotspotModal');
    const hotspotForm = document.getElementById('hotspotForm');
    const addHotspotBtn = document.getElementById('addHotspotBtn');
    const saveHotspotBtn = document.getElementById('saveHotspotBtn');
    const previewContainer = document.querySelector('.preview-container');
    const hotspotList = document.querySelector('.hotspot-list');
    const houseSelector = document.getElementById('houseSelector');
    const assetHouseSelector = document.getElementById('assetHouseSelector');
    const playlistHouseSelector = document.getElementById('playlistHouseSelector');
    const assetForm = document.getElementById('assetForm');
    const startDrawingBtn = document.getElementById('startDrawing');
    const finishDrawingBtn = document.getElementById('finishDrawing');
    const cancelDrawingBtn = document.getElementById('cancelDrawing');
    const assetTypeSelect = document.getElementById('assetType');
    const hotspotIdContainer = document.getElementById('hotspotIdContainer');
    const hotspotPreview = document.getElementById('hotspotPreview');
    const previewVideo = document.getElementById('previewVideo');
    const uploadAssetBtn = document.getElementById('uploadAssetBtn');
    const uploadAssetModal = document.getElementById('uploadAssetModal');
    const saveAssetBtn = document.getElementById('saveAssetBtn');
    const uploadAssetForm = document.getElementById('uploadAssetForm');

    // Drawing state
    let isDrawing = false;
    let currentPoints = [];
    let currentPolygon = null;
    let currentPointsGroup = null;
    let drawingInstructions = null;

    // Navigation event handlers
    navButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const targetSection = button.dataset.section;
            
            // Update active state of navigation buttons
            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Hide all sections
            sections.forEach(section => section.style.display = 'none');
            
            // Show target section
            const targetElement = document.getElementById(`${targetSection}Section`);
            if (targetElement) {
                targetElement.style.display = 'block';
                
                // Load section-specific data
                if (targetSection === 'assets') {
                    await loadAssets(currentHouse);
                } else if (targetSection === 'playlists') {
                    await initializeVideoPlaylists(currentHouse);
                } else if (targetSection === 'hotspots') {
                    updateHotspotList();
                    updatePreview();
                }
            }
        });
    });

    // Apply Changes button handler
    applyChangesBtn.addEventListener('click', async () => {
        try {
            // Show loading state
            applyChangesBtn.disabled = true;
            applyChangesBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Applying...';
            
            // Save hotspots first
            await saveHotspots();
            
            // Force reload of hotspots and assets in the front end
            const response = await fetch(`/api/reload?_=${Date.now()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ houseId: currentHouse })
            });
            
            if (!response.ok) {
                throw new Error('Failed to reload front end');
            }
            
            // Show success message
            uploadToastElement.querySelector('.toast-body').textContent = 'Changes applied successfully!';
            uploadToast.show();
        } catch (error) {
            console.error('Error applying changes:', error);
            uploadToastElement.querySelector('.toast-body').textContent = 'Failed to apply changes. Please try again.';
            uploadToast.show();
        } finally {
            // Reset button state
            applyChangesBtn.disabled = false;
            applyChangesBtn.innerHTML = 'Apply Changes';
        }
    });

    // Initialize house selectors
    if (houseSelector) {
        houseSelector.value = currentHouse.toString();
    }
    if (assetHouseSelector) {
        assetHouseSelector.value = currentHouse.toString();
    }

    // House selection event handlers
    async function updateCurrentHouse(newHouseId) {
        if (currentHouse === newHouseId) return;
        console.log('Updating current house to:', newHouseId);
        currentHouse = newHouseId;
        
        // Update hotspot house selector only
        if (houseSelector) houseSelector.value = newHouseId.toString();
        
        try {
            // Load house-specific data (hotspots only)
            await loadHotspots(newHouseId);
            
            // Update preview if in hotspots section
            const hotspotsSection = document.getElementById('hotspotsSection');
            if (hotspotsSection && hotspotsSection.style.display !== 'none') {
                updateHotspotList();
                updatePreview();
            }
        } catch (error) {
            console.error('Error updating house data:', error);
            showNotification('Error updating house data: ' + error.message, 'error');
        }
    }

    // Separate handler for asset house selection
    async function updateAssetHouse(newHouseId) {
        if (currentAssetHouse === newHouseId) return;
        console.log('Updating asset house to:', newHouseId);
        currentAssetHouse = newHouseId;
        
        // Update asset house selector only
        if (assetHouseSelector) assetHouseSelector.value = newHouseId.toString();
        
        try {
            // Load assets for the selected house
            await loadAssets(newHouseId);
            await loadAerialVideo(newHouseId);
        } catch (error) {
            console.error('Error updating asset house data:', error);
            showNotification('Error updating asset house data: ' + error.message, 'error');
        }
    }

    // Separate handler for playlist house selection
    async function updatePlaylistHouse(newHouseId) {
        if (currentPlaylistHouse === newHouseId) return;
        console.log('Updating playlist house to:', newHouseId);
        currentPlaylistHouse = newHouseId;
        
        // Update playlist house selector only
        if (playlistHouseSelector) playlistHouseSelector.value = newHouseId.toString();
        
        try {
            // Load playlists for the selected house
            const playlists = await loadPlaylists(newHouseId);
            updatePlaylistUI(playlists);
        } catch (error) {
            console.error('Error updating playlist house data:', error);
            showNotification('Error updating playlist house data: ' + error.message, 'error');
        }
    }

    // Update house selector event listeners
    houseSelector.addEventListener('change', (e) => {
        updateCurrentHouse(parseInt(e.target.value));
    });

    assetHouseSelector.addEventListener('change', (e) => {
        updateAssetHouse(parseInt(e.target.value));
    });

    if (playlistHouseSelector) {
        playlistHouseSelector.addEventListener('change', (e) => {
            updatePlaylistHouse(parseInt(e.target.value));
        });
    }

    // Load playlists from server
    async function loadPlaylists(houseId) {
        try {
            console.log('Loading playlists for house:', houseId);
            const response = await fetch(`/api/playlists?houseId=${houseId}&_=${Date.now()}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to load playlists');
            }
            const data = await response.json();
            console.log('Raw playlist data:', data);
            return data.playlists || {};
        } catch (error) {
            console.error('Error loading playlists:', error);
            showError('Error loading playlists: ' + error.message);
            return {};
        }
    }

    // Load hotspots from server
    async function loadHotspots(houseId) {
        if (!houseId) {
            console.error('No houseId provided to loadHotspots');
            return;
        }

        try {
            console.log('Loading hotspots for house:', houseId);
            const response = await fetch(`/api/hotspots?houseId=${houseId}&_=${Date.now()}`);
            if (!response.ok) {
                throw new Error('Failed to load hotspots');
            }
            
            const data = await response.json();
            console.log('Loaded hotspots data:', data);
            
            if (!data || !data.hotspots) {
                throw new Error('Invalid response format from server');
            }
            
            // Add points to Theater hotspot if it has none
            const updatedHotspots = data.hotspots.map(hotspot => {
                if (hotspot.title === 'Theater' && (!hotspot.points || hotspot.points.length === 0)) {
                    return {
                        ...hotspot,
                        points: [
                            { x: 40, y: 40 },
                            { x: 60, y: 40 },
                            { x: 60, y: 60 },
                            { x: 40, y: 60 }
                        ]
                    };
                }
                return hotspot;
            });
            
            window.hotspots = updatedHotspots;
            console.log('Updated hotspots array:', window.hotspots);
            updateHotspotList();
            updatePreview();
            return window.hotspots;
        } catch (error) {
            console.error('Error loading hotspots:', error);
            throw error;
        }
    }

    // Load assets from server
    async function loadAssets(houseId) {
        try {
            console.log('Loading assets for house:', houseId);
            const response = await fetch(`/api/assets?houseId=${houseId}&_=${Date.now()}`);
            if (!response.ok) throw new Error('Failed to load assets');
            
            const data = await response.json();
            if (!data || !data.assets) throw new Error('Invalid response format');
            
            console.log('Loaded assets:', data.assets);
            assets = data.assets; // Store assets in global array

            // Update assets table
            const tableBody = document.getElementById('assetsTableBody');
            if (tableBody) {
                tableBody.innerHTML = data.assets.map(asset => `
                    <tr>
                        <td>${asset.name || 'Unnamed Asset'}</td>
                        <td>${asset.type}</td>
                        <td>
                            <video class="img-fluid" style="max-width: 200px;" controls muted>
                                <source src="${asset.url}" type="video/mp4">
                            </video>
                        </td>
                        <td>
                            <button class="btn btn-sm btn-outline-light me-2" onclick="editAsset('${asset._id}', '${asset.type}')">
                                Edit
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteAsset('${asset._id}')">
                                Delete
                            </button>
                        </td>
                    </tr>
                `).join('');

                // Add event listeners to delete buttons
                tableBody.querySelectorAll('button[onclick^="deleteAsset"]').forEach(button => {
                    button.addEventListener('click', () => deleteAsset(button.closest('tr').querySelector('button[onclick^="deleteAsset"]').getAttribute('onclick').match(/'([^']+)'/)[1]));
                });

                // Initialize video optimization for all videos in the table
                tableBody.querySelectorAll('video').forEach(video => {
                    optimizeVideoPlayback(video);
                });
            }

            return assets;
        } catch (error) {
            console.error('Error loading assets:', error);
            alert('Failed to load assets. Please refresh the page.');
            return [];
        }
    }

    // Initialize video playlists
    async function initializeVideoPlaylists(houseId) {
        if (isInitializing) {
            console.log('Initialization already in progress, skipping...');
            return;
        }
        
        isInitializing = true;
        try {
            // Load global videos and assets in parallel
            const [globalVideosResponse, assetsResponse] = await Promise.all([
                fetch(`/api/global-videos?_=${Date.now()}`),
                fetch(`/api/assets?houseId=${houseId}&_=${Date.now()}`)
            ]);

            if (!globalVideosResponse.ok) throw new Error('Failed to load global videos');
            if (!assetsResponse.ok) throw new Error('Failed to load assets');

            const { globalVideos } = await globalVideosResponse.json();
            const { assets: houseAssets } = await assetsResponse.json();
            
            // Store assets globally for use in other functions
            assets = houseAssets;
            
            // Store current global videos state
            currentGlobalVideos = globalVideos;
            
            // Update the global videos UI
            updateGlobalVideosUI(globalVideos);
            
            // Load hotspot videos for the current house
            const hotspotVideosResponse = await fetch(`/api/hotspot-videos?houseId=${houseId}&_=${Date.now()}`);
            if (!hotspotVideosResponse.ok) throw new Error('Failed to load hotspot videos');
            const { hotspotVideos } = await hotspotVideosResponse.json();
            
            // Update the hotspot videos UI
            updateHotspotVideosUI(hotspotVideos);
            
        } catch (error) {
            console.error('Error initializing video playlists:', error);
            showNotification('Error loading video playlists: ' + error.message, 'error');
        } finally {
            isInitializing = false;
        }
    }

    // Update global videos UI
    function updateGlobalVideosUI(globalVideos) {
        if (!globalVideos) return;
        
        // Get available videos
        const aerialVideos = assets.filter(asset => asset.type === 'aerial');
        const transitionVideos = assets.filter(asset => asset.type === 'transition');
        
        // Update each global video select
        const globalVideoTypes = {
            kopAerial: { videos: aerialVideos, label: 'KOP Aerial' },
            dallasAerial: { videos: aerialVideos, label: 'DALLAS Aerial' },
            kopToDallas: { videos: transitionVideos, label: 'KOP to DALLAS Transition' },
            dallasToKop: { videos: transitionVideos, label: 'DALLAS to KOP Transition' }
        };
        
        Object.entries(globalVideoTypes).forEach(([type, { videos, label }]) => {
            const select = document.getElementById(`${type}Select`);
            if (!select) return;
            
            // Store current value
            const currentValue = select.value;
            
            // Update options
            select.innerHTML = `
                <option value="">Select ${label}</option>
                ${videos.map(asset => `
                    <option value="${asset._id}" 
                        ${globalVideos[type]?.videoId === asset._id ? 'selected' : ''}>
                        ${asset.name || 'Unnamed Asset'}
                    </option>
                `).join('')}
            `;
            
            // Restore current value if it exists in new options
            if (currentValue && videos.some(v => v._id === currentValue)) {
                select.value = currentValue;
            }
            
            // Update preview if it exists
            const preview = document.querySelector(`#${type}Preview`);
            if (preview && globalVideos[type]?.videoId) {
                const video = videos.find(v => v._id === globalVideos[type].videoId);
                if (video) {
                    preview.src = video.url;
                    preview.style.display = 'block';
                }
            }
            
            // Add change event listener if not already present
            if (!select.hasEventListener) {
                select.addEventListener('change', () => updateGlobalVideo(type, select.value));
                select.hasEventListener = true;
            }
        });
    }

    // Update global video
    async function updateGlobalVideo(type, videoId) {
        console.log("updateGlobalVideo called with type:", type, "videoId:", videoId);
        try {
            const payload = { type, videoId };
            const response = await fetch('/api/global-videos', {
                method: 'POST',
                
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error("Error updating global video:", errorText);
                throw new Error(errorText);
            }
            
            const data = await response.json();
            console.log("updateGlobalVideo response:", data);
            
            // Update the UI immediately with the new data
            if (data.globalVideos) {
                // Update the select element
                const select = document.getElementById(`${type}Select`);
                if (select) {
                    select.value = videoId;
                }
                
                // Update the preview if it exists
                const preview = document.querySelector(`#${type}Preview`);
                if (preview && videoId) {
                    const video = assets.find(a => a._id === videoId);
                    if (video) {
                        preview.src = video.url;
                        preview.style.display = 'block';
                    }
                }
                
                // Show success notification
                showNotification(`Global video updated successfully for ${type}`, 'success');
            }
        } catch (error) {
            console.error("Error in updateGlobalVideo:", error);
            showNotification(`Error updating global video: ${error.message}`, 'error');
        }
    }

    // Save global videos
    async function saveGlobalVideos(globalVideos) {
        try {
            const response = await fetch('/api/global-videos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ globalVideos })
            });
            
            if (!response.ok) throw new Error('Failed to save global videos');
            
            const result = await response.json();
            console.log('Saved global videos:', result);
            return result;
        } catch (error) {
            console.error('Error saving global videos:', error);
            throw error;
        }
    }

    // Save playlists
    async function savePlaylists(houseId, playlists) {
        try {
            console.log('Saving playlists:', {
                houseId,
                playlists
            });
            
            const response = await fetch(`/api/playlists?houseId=${houseId}&_=${Date.now()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    houseId: parseInt(houseId),
                    playlists: playlists
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save playlists');
            }

            const result = await response.json();
            console.log('Save playlists result:', result);
            return result;
        } catch (error) {
            console.error('Error saving playlists:', error);
            throw error;
        }
    }

    // Initialize asset types with proper error handling
    function initializeAssetTypes() {
        const assetTypes = {
            aerial: {
                uploadArea: document.getElementById('aerialUploadArea'),
                input: document.getElementById('aerialUpload'),
                progress: document.getElementById('aerialUploadProgress'),
                currentAsset: document.getElementById('aerialCurrentAsset'),
                type: 'aerial'
            },
            transition: {
                uploadArea: document.getElementById('transitionUploadArea'),
                input: document.getElementById('transitionUpload'),
                progress: document.getElementById('transitionUploadProgress'),
                currentAsset: document.getElementById('transitionCurrentAsset'),
                type: 'transition'
            },
            zoomOut: {
                uploadArea: document.getElementById('zoomOutUploadArea'),
                input: document.getElementById('zoomOutUpload'),
                progress: document.getElementById('zoomOutUploadProgress'),
                currentAsset: document.getElementById('zoomOutCurrentAsset'),
                type: 'zoomOut'
            },
            diveIn: {
                uploadArea: document.getElementById('diveInUploadArea'),
                input: document.getElementById('diveInUpload'),
                progress: document.getElementById('diveInUploadProgress'),
                currentAsset: document.getElementById('diveInCurrentAsset'),
                type: 'diveIn'
            },
            floorLevel: {
                uploadArea: document.getElementById('floorLevelUploadArea'),
                input: document.getElementById('floorLevelUpload'),
                progress: document.getElementById('floorLevelUploadProgress'),
                currentAsset: document.getElementById('floorLevelCurrentAsset'),
                type: 'floorLevel'
            }
        };

        // Create missing elements if they don't exist
        Object.entries(assetTypes).forEach(([type, config]) => {
            if (!config.uploadArea || !config.input) {
                console.warn(`Creating missing elements for asset type: ${type}`);
                const container = document.getElementById('assetUploadContainer');
                if (container) {
                    const card = document.createElement('div');
                    card.className = 'card bg-dark mb-3';
                    card.innerHTML = `
                        <div class="card-body">
                            <h6 class="card-title">${type.charAt(0).toUpperCase() + type.slice(1)} Video</h6>
                            <div class="upload-area" id="${type}UploadArea">
                                <p class="mb-2">Upload ${type} video</p>
                                <input type="file" class="d-none" id="${type}Upload" accept="video/*">
                                <button class="btn btn-outline-light" onclick="document.getElementById('${type}Upload').click()">
                                    Select Video
                                </button>
                            </div>
                            <div class="progress d-none" id="${type}UploadProgress">
                                <div class="progress-bar" role="progressbar" style="width: 0%"></div>
                            </div>
                            <div class="current-asset mt-2" id="${type}CurrentAsset">
                                <!-- Current asset will be shown here -->
                            </div>
                        </div>
                    `;
                    container.appendChild(card);
                    
                    // Update references
                    assetTypes[type].uploadArea = document.getElementById(`${type}UploadArea`);
                    assetTypes[type].input = document.getElementById(`${type}Upload`);
                    assetTypes[type].progress = document.getElementById(`${type}UploadProgress`);
                    assetTypes[type].currentAsset = document.getElementById(`${type}CurrentAsset`);
                }
            }
        });

        // Initialize drag and drop for all upload areas
        Object.values(assetTypes).forEach(assetType => {
            if (!assetType.uploadArea || !assetType.input) {
                console.warn(`Missing elements for asset type: ${assetType.type}`);
                return;
            }

            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                assetType.uploadArea.addEventListener(eventName, preventDefaults, false);
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                assetType.uploadArea.addEventListener(eventName, () => highlight(assetType.uploadArea), false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                assetType.uploadArea.addEventListener(eventName, () => unhighlight(assetType.uploadArea), false);
            });

            assetType.uploadArea.addEventListener('drop', (e) => handleDrop(e, assetType), false);
            assetType.input.addEventListener('change', (e) => handleFiles(e.target.files, assetType));
        });

        return assetTypes;
    }

    // Initialize zone transitions with floor level assets
    function initializeZoneTransitions() {
        const zoneTransitionsContainer = document.getElementById('zoneTransitionsContainer');
        const floorLevelAssetsContainer = document.getElementById('floorLevelAssetsContainer');
        if (!zoneTransitionsContainer || !floorLevelAssetsContainer) return;

        const currentHotspots = window.hotspots.filter(h => h.houseId === parseInt(assetHouseSelector.value) && h.type === 'primary');
        
        // Initialize zone transitions
        zoneTransitionsContainer.innerHTML = currentHotspots.map(hotspot => `
            <div class="col-md-6 mb-3">
                <div class="card bg-dark">
                    <div class="card-body">
                        <h6 class="card-title">${hotspot.title} Zone</h6>
                        <div class="mb-3">
                            <div class="upload-area" id="zoneTransitionUploadArea_${hotspot._id}">
                                <p class="mb-2">Dive In Video</p>
                                <input type="file" class="d-none" id="zoneTransitionUpload_${hotspot._id}" accept="video/*">
                                <button class="btn btn-outline-light" onclick="document.getElementById('zoneTransitionUpload_${hotspot._id}').click()">
                                    Select Video
                                </button>
                            </div>
                            <div class="progress d-none" id="zoneTransitionUploadProgress_${hotspot._id}">
                                <div class="progress-bar" role="progressbar" style="width: 0%"></div>
                            </div>
                            <div class="current-asset mt-2" id="zoneTransitionCurrentAsset_${hotspot._id}">
                                <!-- Current asset will be shown here -->
                            </div>
                        </div>
                        <div class="upload-area" id="zoomOutUploadArea_${hotspot._id}">
                            <p class="mb-2">Zoom Out Video</p>
                            <input type="file" class="d-none" id="zoomOutUpload_${hotspot._id}" accept="video/*">
                            <button class="btn btn-outline-light" onclick="document.getElementById('zoomOutUpload_${hotspot._id}').click()">
                                Select Video
                            </button>
                        </div>
                        <div class="progress d-none" id="zoomOutUploadProgress_${hotspot._id}">
                            <div class="progress-bar" role="progressbar" style="width: 0%"></div>
                        </div>
                        <div class="current-asset mt-2" id="zoomOutCurrentAsset_${hotspot._id}">
                            <!-- Current asset will be shown here -->
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        // Initialize floor level assets
        floorLevelAssetsContainer.innerHTML = currentHotspots.map(hotspot => `
            <div class="col-md-6 mb-3">
                <div class="card bg-dark">
                    <div class="card-body">
                        <h6 class="card-title">${hotspot.title} Floor Level</h6>
                        <div class="upload-area" id="floorLevelUploadArea_${hotspot._id}">
                            <p class="mb-2">Floor Level Video</p>
                            <input type="file" class="d-none" id="floorLevelUpload_${hotspot._id}" accept="video/*">
                            <button class="btn btn-outline-light" onclick="document.getElementById('floorLevelUpload_${hotspot._id}').click()">
                                Select Video
                            </button>
                        </div>
                        <div class="progress d-none" id="floorLevelUploadProgress_${hotspot._id}">
                            <div class="progress-bar" role="progressbar" style="width: 0%"></div>
                        </div>
                        <div class="current-asset mt-2" id="floorLevelCurrentAsset_${hotspot._id}">
                            <!-- Current asset will be shown here -->
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        // Initialize upload areas for each zone
        currentHotspots.forEach(hotspot => {
            // Dive In upload
            const diveInUploadArea = document.getElementById(`zoneTransitionUploadArea_${hotspot._id}`);
            const diveInInput = document.getElementById(`zoneTransitionUpload_${hotspot._id}`);
            
            if (diveInUploadArea && diveInInput) {
                ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                    diveInUploadArea.addEventListener(eventName, preventDefaults, false);
                });

                ['dragenter', 'dragover'].forEach(eventName => {
                    diveInUploadArea.addEventListener(eventName, () => highlight(diveInUploadArea), false);
                });

                ['dragleave', 'drop'].forEach(eventName => {
                    diveInUploadArea.addEventListener(eventName, () => unhighlight(diveInUploadArea), false);
                });

                diveInUploadArea.addEventListener('drop', (e) => handleDrop(e, { 
                    type: 'zoneTransition', 
                    hotspotId: hotspot._id,
                    progress: document.getElementById(`zoneTransitionUploadProgress_${hotspot._id}`),
                    input: diveInInput
                }), false);
                
                diveInInput.addEventListener('change', (e) => handleFiles(e.target.files, { 
                    type: 'zoneTransition', 
                    hotspotId: hotspot._id,
                    progress: document.getElementById(`zoneTransitionUploadProgress_${hotspot._id}`),
                    input: diveInInput
                }));
            }

            // Zoom Out upload
            const zoomOutUploadArea = document.getElementById(`zoomOutUploadArea_${hotspot._id}`);
            const zoomOutInput = document.getElementById(`zoomOutUpload_${hotspot._id}`);
            
            if (zoomOutUploadArea && zoomOutInput) {
                ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                    zoomOutUploadArea.addEventListener(eventName, preventDefaults, false);
                });

                ['dragenter', 'dragover'].forEach(eventName => {
                    zoomOutUploadArea.addEventListener(eventName, () => highlight(zoomOutUploadArea), false);
                });

                ['dragleave', 'drop'].forEach(eventName => {
                    zoomOutUploadArea.addEventListener(eventName, () => unhighlight(zoomOutUploadArea), false);
                });

                zoomOutUploadArea.addEventListener('drop', (e) => handleDrop(e, { 
                    type: 'zoomOut', 
                    hotspotId: hotspot._id,
                    progress: document.getElementById(`zoomOutUploadProgress_${hotspot._id}`),
                    input: zoomOutInput
                }), false);
                
                zoomOutInput.addEventListener('change', (e) => handleFiles(e.target.files, { 
                    type: 'zoomOut', 
                    hotspotId: hotspot._id,
                    progress: document.getElementById(`zoomOutUploadProgress_${hotspot._id}`),
                    input: zoomOutInput
                }));
            }

            // Floor level upload
            const floorUploadArea = document.getElementById(`floorLevelUploadArea_${hotspot._id}`);
            const floorInput = document.getElementById(`floorLevelUpload_${hotspot._id}`);
            
            if (floorUploadArea && floorInput) {
                ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                    floorUploadArea.addEventListener(eventName, preventDefaults, false);
                });

                ['dragenter', 'dragover'].forEach(eventName => {
                    floorUploadArea.addEventListener(eventName, () => highlight(floorUploadArea), false);
                });

                ['dragleave', 'drop'].forEach(eventName => {
                    floorUploadArea.addEventListener(eventName, () => unhighlight(floorUploadArea), false);
                });

                floorUploadArea.addEventListener('drop', (e) => handleDrop(e, { 
                    type: 'floorLevel', 
                    hotspotId: hotspot._id,
                    progress: document.getElementById(`floorLevelUploadProgress_${hotspot._id}`),
                    input: floorInput
                }), false);
                
                floorInput.addEventListener('change', (e) => handleFiles(e.target.files, { 
                    type: 'floorLevel', 
                    hotspotId: hotspot._id,
                    progress: document.getElementById(`floorLevelUploadProgress_${hotspot._id}`),
                    input: floorInput
                }));
            }
        });
    }

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight(element) {
        element.classList.add('dragover');
    }

    function unhighlight(element) {
        element.classList.remove('dragover');
    }

    function handleDrop(e, assetType) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files, assetType);
    }

    function handleFiles(files, assetType) {
        if (files.length === 0) return;
        const file = files[0];
        if (!file.type.startsWith('video/')) {
            uploadToastElement.querySelector('.toast-body').textContent = 'Please upload a video file';
            uploadToast.show();
            return;
        }

        // Create a progress bar for hotspot uploads
        if (assetType.type === 'hotspot') {
            const hotspotId = assetType.hotspotId;
            const hotspotCard = document.querySelector(`#hotspotUploadArea_${hotspotId}`).closest('.card');
            let progressBar = hotspotCard.querySelector('.progress');
            
            if (!progressBar) {
                progressBar = document.createElement('div');
                progressBar.className = 'progress d-none';
                progressBar.innerHTML = '<div class="progress-bar" role="progressbar" style="width: 0%"></div>';
                hotspotCard.querySelector('.card-body').appendChild(progressBar);
            }
            
            assetType.progress = progressBar;
        }

        uploadFile(file, assetType);
    }

    async function uploadFile(file, assetType) {
        const progressBar = assetType.progress;
        const progressBarInner = progressBar?.querySelector('.progress-bar');
        
        try {
            if (progressBar && progressBarInner) {
                progressBar.classList.remove('d-none');
                progressBarInner.style.width = '0%';
            }

            const formData = new FormData();
            formData.append('asset', file);
            formData.append('houseId', assetHouseSelector.value);
            
            // Handle different asset types
            if (assetType.type === 'zoneTransition') {
                formData.append('type', 'diveIn');
                formData.append('hotspotId', assetType.hotspotId);
            } else if (assetType.type === 'floorLevel') {
                formData.append('type', 'floorLevel');
                formData.append('hotspotId', assetType.hotspotId);
            } else if (assetType.type === 'zoomOut') {
                formData.append('type', 'zoomOut');
                formData.append('hotspotId', assetType.hotspotId);
            } else {
                formData.append('type', assetType.type);
            }

            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && progressBarInner) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    progressBarInner.style.width = percentComplete + '%';
                }
            });

            xhr.onload = function() {
                if (xhr.status === 200) {
                    uploadToastElement.querySelector('.toast-body').textContent = 'Asset uploaded successfully!';
                    uploadToast.show();
                    loadAssets(assetHouseSelector.value);
                    
                    // If this was a hotspot-specific upload, update the playlist UI
                    if (assetType.hotspotId) {
                        loadPlaylists(assetHouseSelector.value).then(playlists => {
                            updatePlaylistUI(playlists);
                        });
                    }
                } else {
                    throw new Error('Upload failed');
                }
            };

            xhr.onerror = function() {
                throw new Error('Upload failed');
            };

            xhr.open('POST', '/api/assets', true);
            xhr.send(formData);

        } catch (error) {
            console.error('Upload error:', error);
            uploadToastElement.querySelector('.toast-body').textContent = 'Failed to upload asset. Please try again.';
            uploadToast.show();
        } finally {
            if (progressBar && progressBarInner) {
                progressBar.classList.add('d-none');
                progressBarInner.style.width = '0%';
            }
            if (assetType.input) {
                assetType.input.value = '';
            }
        }
    }

    // Initialize interact.js for draggable hotspots
    interact('.hotspot-preview')
        .draggable({
            inertia: true,
            modifiers: [
                interact.modifiers.restrictRect({
                    restriction: 'parent',
                    endOnly: false
                })
            ],
            autoScroll: true,
            listeners: {
                move: dragMoveListener,
                end: function(event) {
                    const hotspot = event.target;
                    const rect = hotspot.getBoundingClientRect();
                    const containerRect = previewContainer.getBoundingClientRect();
                    
                    // Calculate position relative to container
                    const relativeX = rect.left - containerRect.left;
                    const relativeY = rect.top - containerRect.top;
                    
                    // Convert to percentages
                    const posX = Math.max(0, Math.min((relativeX / containerRect.width) * 100, 100));
                    const posY = Math.max(0, Math.min((relativeY / containerRect.height) * 100, 100));
                    
                    // Update hotspot data
                    const hotspotId = hotspot.getAttribute('data-id');
                    const hotspotIndex = window.hotspots.findIndex(h => h._id === hotspotId);
                    if (hotspotIndex !== -1) {
                        window.hotspots[hotspotIndex].posX = posX;
                        window.hotspots[hotspotIndex].posY = posY;
                        updateHotspotList();
                        saveHotspots();
                    }
                }
            }
        });

    function dragMoveListener(event) {
        const target = event.target;
        const rect = target.getBoundingClientRect();
        const containerRect = previewContainer.getBoundingClientRect();
        
        // Calculate the maximum allowed positions
        const maxX = containerRect.width - rect.width;
        const maxY = containerRect.height - rect.height;
        
        // Calculate new position
        let x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
        let y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
        
        // Constrain to container bounds
        x = Math.max(0, Math.min(x, maxX));
        y = Math.max(0, Math.min(y, maxY));
        
        // Update position
        target.style.transform = `translate(${x}px, ${y}px)`;
        target.setAttribute('data-x', x);
        target.setAttribute('data-y', y);
    }

    // Add new hotspot
    addHotspotBtn.addEventListener('click', () => {
        // Reset state
        hotspotForm.reset();
        currentPolygon = null;
        currentPoints = [];
        if (currentPointsGroup) {
            currentPointsGroup.remove();
            currentPointsGroup = null;
        }

        // Enable/disable buttons
        startDrawingBtn.disabled = false;
        finishDrawingBtn.disabled = true;
        cancelDrawingBtn.disabled = true;

        // Create and show drawing instructions
        if (!drawingInstructions) {
            drawingInstructions = document.createElement('div');
            drawingInstructions.className = 'drawing-instructions';
            drawingInstructions.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 20px;
                border-radius: 8px;
                text-align: center;
                z-index: 1000;
            `;
            previewContainer.appendChild(drawingInstructions);
        }
        drawingInstructions.innerHTML = `
            <h4>Create New Hotspot</h4>
            <p>1. Click "Start Drawing" to begin</p>
            <p>2. Click on the preview to create points</p>
            <p>3. Create at least 3 points to form a polygon</p>
            <p>4. Click "Finish Drawing" when done</p>
        `;
        drawingInstructions.style.display = 'block';
    });

    // Drawing Functions
    startDrawingBtn.addEventListener('click', () => {
        isDrawing = true;
        currentPoints = [];
        
        // Clear any existing SVG
        const existingSvg = previewContainer.querySelector('svg');
        if (existingSvg) {
            existingSvg.remove();
        }
        
        // Create new SVG container
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.pointerEvents = 'all';
        svg.style.zIndex = '1000';
        svg.style.width = '100%';
        svg.style.height = '100%';
        previewContainer.appendChild(svg);
        
        console.log('=== SVG Container Created ===');
        console.log('SVG Element:', {
            width: svg.getAttribute('width'),
            height: svg.getAttribute('height'),
            viewBox: svg.getAttribute('viewBox'),
            style: svg.style.cssText
        });
        console.log('Container:', {
            width: previewContainer.clientWidth,
            height: previewContainer.clientHeight,
            style: previewContainer.style.cssText
        });
        
        // Create points group
        currentPointsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        svg.appendChild(currentPointsGroup);
        
        // Create polygon
        currentPolygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        currentPolygon.style.fill = 'rgba(229, 9, 20, 0.2)';
        currentPolygon.style.stroke = '#e50914';
        currentPolygon.style.strokeWidth = '0.5';
        currentPolygon.style.strokeDasharray = '2,2';
        currentPolygon.style.strokeLinecap = 'round';
        currentPolygon.style.strokeLinejoin = 'round';
        svg.appendChild(currentPolygon);
        
        // Add click handler to SVG
        svg.addEventListener('click', handlePreviewClick);
        
        // Enable/disable buttons
        startDrawingBtn.disabled = true;
        finishDrawingBtn.disabled = false;
        cancelDrawingBtn.disabled = false;
        
        // Hide instructions
        if (drawingInstructions) {
            drawingInstructions.style.display = 'none';
        }

        // Show drawing status
        const status = document.createElement('div');
        status.className = 'drawing-status';
        status.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px;
            border-radius: 4px;
            z-index: 1001;
        `;
        status.textContent = 'Drawing mode active - Click to add points';
        previewContainer.appendChild(status);

        console.log('Drawing mode started');
    });

    function handlePreviewClick(e) {
        if (!isDrawing) return;
        
        // Prevent event from bubbling
        e.stopPropagation();
        
        // Get the preview container's dimensions and position
        const containerRect = previewContainer.getBoundingClientRect();
        
        // Calculate click position relative to the container
        const clickX = e.clientX - containerRect.left;
        const clickY = e.clientY - containerRect.top;
        
        // Calculate percentage position within the container
        const percentX = (clickX / containerRect.width) * 100;
        const percentY = (clickY / containerRect.height) * 100;
        
        // Store the percentage coordinates
        currentPoints.push({ 
            x: parseFloat(percentX.toFixed(2)),
            y: parseFloat(percentY.toFixed(2))
        });
        
        console.log('=== Click Event Details ===');
        console.log('Container:', {
            width: containerRect.width,
            height: containerRect.height,
            left: containerRect.left,
            top: containerRect.top
        });
        console.log('Mouse Position:', {
            clientX: e.clientX,
            clientY: e.clientY
        });
        console.log('Calculated Position:', {
            clickX: clickX,
            clickY: clickY,
            percentX: percentX,
            percentY: percentY
        });
        console.log('Current Points Array:', JSON.stringify(currentPoints, null, 2));
        
        // Draw point
        const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        point.setAttribute('cx', percentX);
        point.setAttribute('cy', percentY);
        point.setAttribute('r', '1'); // Smaller radius for better precision
        point.style.fill = '#e50914';
        currentPointsGroup.appendChild(point);
        
        // Update polygon
        const points = currentPoints.map(p => `${p.x},${p.y}`).join(' ');
        currentPolygon.setAttribute('points', points);
        
        console.log('=== Polygon Details ===');
        console.log('Points String:', points);
        console.log('SVG Element:', {
            width: currentPolygon.parentElement.getAttribute('width'),
            height: currentPolygon.parentElement.getAttribute('height'),
            viewBox: currentPolygon.parentElement.getAttribute('viewBox')
        });
        
        // Update status
        const status = previewContainer.querySelector('.drawing-status');
        if (status) {
            status.textContent = `Points: ${currentPoints.length} - Click to add more or click "Finish Drawing"`;
        }
        
        // Enable finish button if we have enough points
        finishDrawingBtn.disabled = currentPoints.length < 3;
    }

    finishDrawingBtn.addEventListener('click', () => {
        if (currentPoints.length < 3) {
            alert('Please draw at least 3 points to create a polygon');
            return;
        }
        
        isDrawing = false;
        
        // Remove click handler from SVG
        const svg = previewContainer.querySelector('svg');
        if (svg) {
            svg.removeEventListener('click', handlePreviewClick);
        }
        
        // Reset button states
        startDrawingBtn.disabled = false;
        finishDrawingBtn.disabled = true;
        cancelDrawingBtn.disabled = true;
        
        // Remove status
        const status = previewContainer.querySelector('.drawing-status');
        if (status) {
            status.remove();
        }
        
        // Show modal
        const modal = new bootstrap.Modal(hotspotModal);
        modal.show();
    });

    cancelDrawingBtn.addEventListener('click', () => {
        isDrawing = false;
        currentPoints = [];
        
        // Remove click handler from SVG
        const svg = previewContainer.querySelector('svg');
        if (svg) {
            svg.removeEventListener('click', handlePreviewClick);
            svg.remove();
        }
        
        if (currentPolygon) {
            currentPolygon = null;
        }
        if (currentPointsGroup) {
            currentPointsGroup = null;
        }
        
        // Reset button states
        startDrawingBtn.disabled = false;
        finishDrawingBtn.disabled = true;
        cancelDrawingBtn.disabled = true;
        
        if (drawingInstructions) {
            drawingInstructions.style.display = 'block';
        }
        
        // Remove status
        const status = previewContainer.querySelector('.drawing-status');
        if (status) {
            status.remove();
        }
    });

    // Save hotspot
    saveHotspotBtn.addEventListener('click', async () => {
        if (!hotspotForm.checkValidity()) {
            hotspotForm.reportValidity();
            return;
        }

        const formData = new FormData(hotspotForm);
        const hotspotData = {
            title: formData.get('title'),
            type: formData.get('type'),
            description: formData.get('description') || '',
            points: currentPoints.map(point => ({
                x: parseFloat(point.x.toFixed(2)),
                y: parseFloat(point.y.toFixed(2))
            })),
            houseId: currentHouse
        };

        // Validate required fields
        if (!hotspotData.title || !hotspotData.type) {
            alert('Please fill in all required fields (Title and Type)');
            return;
        }

        // Validate points
        if (!hotspotData.points || hotspotData.points.length < 3) {
            alert('Please draw at least 3 points for the hotspot');
            return;
        }

        console.log('Saving hotspot with data:', JSON.stringify(hotspotData, null, 2));

        try {
            // First, get existing hotspots
            const existingResponse = await fetch(`/api/hotspots?houseId=${currentHouse}&_=${Date.now()}`);
            if (!existingResponse.ok) {
                throw new Error('Failed to fetch existing hotspots');
            }
            const existingData = await existingResponse.json();
            const existingHotspots = existingData.hotspots || [];

            // Add new hotspot to existing ones
            const updatedHotspots = [...existingHotspots, hotspotData];

            // Save all hotspots
            const response = await fetch('/api/hotspots', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    houseId: currentHouse,
                    hotspots: updatedHotspots
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to save hotspot');
            }

            const result = await response.json();
            console.log('Save result:', JSON.stringify(result, null, 2));

            // Initialize videos for the new hotspot
            const newHotspot = result.hotspots[result.hotspots.length - 1];
            if (newHotspot && newHotspot._id) {
                await initializeHotspotVideos(newHotspot._id);
            }

            // Reset form and points
            hotspotForm.reset();
            currentPoints = [];
            if (currentPolygon) {
                currentPolygon.remove();
                currentPolygon = null;
            }
            if (currentPointsGroup) {
                currentPointsGroup.remove();
                currentPointsGroup = null;
            }

            // Reload hotspots
            await loadHotspots(currentHouse);
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(hotspotModal);
            modal.hide();

            alert('Hotspot saved successfully!');
        } catch (error) {
            console.error('Error saving hotspot:', error);
            alert('Error saving hotspot: ' + error.message);
        }
    });

    // Optimize video playback
    function optimizeVideoPlayback(video) {
        if (!video) return;

        // Set video attributes for better performance
        video.setAttribute('preload', 'metadata');
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        
        // Add event listeners for better playback control
        video.addEventListener('loadedmetadata', () => {
            // Set initial volume
            video.volume = 0.5;
            
            // Enable controls
            video.controls = true;
        });

        // Handle errors
        video.addEventListener('error', (e) => {
            console.error('Video playback error:', e);
        });
    }

    // Load aerial video for the current house
    async function loadAerialVideo(houseId) {
        try {
            console.log('Loading aerial video for house:', houseId);
            const response = await fetch(`/api/assets?houseId=${houseId}&_=${Date.now()}`);
            if (!response.ok) throw new Error('Failed to load assets');
            
            const data = await response.json();
            console.log('Assets response:', data);
            
            // Find aerial video for this house
            const aerialVideo = data.assets.find(asset => asset.type === 'aerial' && asset.houseId === houseId);
            
            if (aerialVideo) {
                console.log('Found aerial video:', aerialVideo);
                // Update the aerial video element
                const aerialVideoElement = document.getElementById('aerialVideo');
                if (aerialVideoElement) {
                    aerialVideoElement.src = aerialVideo.url;
                    aerialVideoElement.load();
                    // Set video attributes
                    aerialVideoElement.loop = true;
                    aerialVideoElement.muted = true;
                    aerialVideoElement.playsInline = true;
                    // Try to play
                    try {
                        await aerialVideoElement.play();
                    } catch (playError) {
                        console.warn('Could not autoplay aerial video:', playError);
                    }
                }
            } else {
                console.log('No aerial video found for house:', houseId);
                // Clear the aerial video element
                const aerialVideoElement = document.getElementById('aerialVideo');
                if (aerialVideoElement) {
                    aerialVideoElement.src = '';
                    aerialVideoElement.load();
                }
            }
        } catch (error) {
            console.error('Error loading aerial video:', error);
            showNotification('Error loading aerial video: ' + error.message, 'error');
        }
    }

    // Initialize video optimization
    function initializeVideoOptimization() {
        // Optimize all videos in the page
        document.querySelectorAll('video').forEach(video => {
            optimizeVideoPlayback(video);
        });
    }

    // Initialize
    async function initialize() {
        try {
            // Initialize asset types first
            const assetTypes = initializeAssetTypes();
            
            // Load hotspots and assets for the current house
            await loadHotspots(currentHouse);
            await loadAssets(currentHouse);
            await loadAerialVideo(currentHouse);
            
            // Initialize video playlists
            await initializeVideoPlaylists(currentHouse);
            
            // Update UI
            updateHotspotList();
            updatePreview();
            
            // Initialize video optimization
            initializeVideoOptimization();
        } catch (error) {
            console.error('Error during initialization:', error);
        }
    }

    // Start initialization
    initialize();

    // Update hotspot list in UI
    window.updateHotspotList = function() {
        const hotspotList = document.querySelector('.hotspot-list');
        if (!hotspotList) return;

        // Filter hotspots for current house
        const currentHotspots = window.hotspots.filter(h => h.houseId === currentHouse);
        console.log('Current hotspots:', currentHotspots);
        
        // Sort hotspots by type (primary first) and then by title
        currentHotspots.sort((a, b) => {
            if (a.type === 'primary' && b.type !== 'primary') return -1;
            if (a.type !== 'primary' && b.type === 'primary') return 1;
            return a.title.localeCompare(b.title);
        });

        hotspotList.innerHTML = currentHotspots.map(hotspot => `
            <div class="hotspot-item" data-hotspot-id="${hotspot._id}">
                <div class="hotspot-info">
                    <h5>${hotspot.title}</h5>
                    <p>Type: ${hotspot.type}</p>
                    ${hotspot.description ? `<p>Description: ${hotspot.description}</p>` : ''}
                    ${(!hotspot.points || hotspot.points.length === 0) ? 
                        '<p class="text-warning">Warning: No points defined for this hotspot</p>' : ''}
                </div>
                <div class="hotspot-actions">
                    <button class="btn btn-sm btn-outline-primary edit-hotspot" data-id="${hotspot._id}">
                        Edit
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-hotspot" data-id="${hotspot._id}" onclick="deleteHotspot('${hotspot._id}')">
                        Delete
                    </button>
                </div>
            </div>
        `).join('');

        // Add event listeners for edit buttons
        hotspotList.querySelectorAll('.edit-hotspot').forEach(button => {
            button.addEventListener('click', () => editHotspot(button.dataset.id));
        });

        // Add click handlers for hotspot items
        hotspotList.querySelectorAll('.hotspot-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't trigger if clicking on buttons
                if (e.target.closest('.hotspot-actions')) return;

                const hotspotId = item.dataset.hotspotId;
                console.log('Clicked hotspot ID:', hotspotId);
                
                // Reset all hotspot items
                hotspotList.querySelectorAll('.hotspot-item').forEach(i => {
                    i.style.backgroundColor = '';
                });
                
                // Highlight clicked item
                item.style.backgroundColor = 'rgba(229, 9, 20, 0.1)';
                
                // Reset all polygons in preview
                const svg = previewContainer.querySelector('svg');
                if (svg) {
                    console.log('Found SVG container');
                    
                    // Reset all polygons
                    svg.querySelectorAll('polygon').forEach(p => {
                        p.setAttribute('fill', 'rgba(229, 9, 20, 0)');
                        p.setAttribute('stroke-width', '0.5');
                    });
                    
                    // Find the group with matching data-id
                    const group = svg.querySelector(`g[data-id="${hotspotId}"]`);
                    console.log('Found group:', group);
                    
                    if (group) {
                        const polygon = group.querySelector('polygon');
                        console.log('Found polygon:', polygon);
                        
                        if (polygon) {
                            // Ensure the polygon has valid points
                            const points = polygon.getAttribute('points');
                            console.log('Polygon points:', points);
                            
                            if (points && points.trim()) {
                                polygon.setAttribute('fill', 'rgba(229, 9, 20, 0.4)');
                                polygon.setAttribute('stroke-width', '1');
                                console.log('Updated polygon styles');
                            } else {
                                console.error('Polygon has no points');
                            }
                        }
                    } else {
                        console.log('No group found with ID:', hotspotId);
                        // Log all available groups for debugging
                        svg.querySelectorAll('g').forEach(g => {
                            console.log('Available group:', g.getAttribute('data-id'));
                        });
                    }
                } else {
                    console.log('No SVG container found');
                }
            });
        });
    }

    // Edit hotspot
    async function editHotspot(hotspotId) {
        const hotspot = window.hotspots.find(h => h._id === hotspotId);
        if (!hotspot) return;

        // Set form values
        document.getElementById('hotspotTitle').value = hotspot.title;
        document.getElementById('hotspotType').value = hotspot.type;
        document.getElementById('hotspotDescription').value = hotspot.description || '';

        // Store current points
        currentPoints = hotspot.points.map(p => ({
            x: p.x,
            y: p.y
        }));

        // Show drawing
        if (currentPolygon) {
            currentPolygon.remove();
        }
        if (currentPointsGroup) {
            currentPointsGroup.remove();
        }

        // Create SVG container if it doesn't exist
        let svg = previewContainer.querySelector('svg');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '100%');
            svg.style.position = 'absolute';
            svg.style.top = '0';
            svg.style.left = '0';
            svg.style.pointerEvents = 'none';
            previewContainer.appendChild(svg);
        }

        // Create points group
        currentPointsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        svg.appendChild(currentPointsGroup);

        // Draw points
        currentPoints.forEach(point => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', point.x);
            circle.setAttribute('cy', point.y);
            circle.setAttribute('r', '4');
            circle.style.fill = '#e50914';
            currentPointsGroup.appendChild(circle);
        });

        // Create polygon
        currentPolygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        currentPolygon.style.fill = 'rgba(229, 9, 20, 0)';
        currentPolygon.style.stroke = '#e50914';
        currentPolygon.style.strokeWidth = '0.5';
        currentPolygon.style.strokeDasharray = '2,2';
        currentPolygon.style.strokeLinecap = 'round';
        currentPolygon.style.strokeLinejoin = 'round';
        const points = currentPoints.map(p => `${p.x},${p.y}`).join(' ');
        currentPolygon.setAttribute('points', points);
        svg.appendChild(currentPolygon);

        // Show modal
        const modal = new bootstrap.Modal(hotspotModal);
        modal.show();
    }

    // Global functions
    window.deleteHotspot = async function(hotspotId) {
        if (!confirm('Are you sure you want to delete this hotspot?')) return;

        try {
            // First, get the hotspot from the local array
            const hotspot = window.hotspots.find(h => h._id === hotspotId);
            if (!hotspot) {
                throw new Error('Hotspot not found');
            }

            // Delete from server
            const response = await fetch(`/api/hotspots/${hotspotId}?_=${Date.now()}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete hotspot');
            }

            // Remove from local array
            window.hotspots = window.hotspots.filter(h => h._id !== hotspotId);
            
            // Update UI
            updateHotspotList();
            updatePreview();

            // Show success message
            const toastElement = document.getElementById('notificationToast');
            if (toastElement) {
                const toast = new bootstrap.Toast(toastElement);
                toastElement.querySelector('.toast-body').textContent = 'Hotspot deleted successfully';
                toast.show();
            }

            // If we're in the playlists section, reload playlists
            const playlistsSection = document.getElementById('playlistsSection');
            if (playlistsSection && playlistsSection.style.display !== 'none') {
                const playlists = await loadPlaylists(currentHouse);
                updatePlaylistUI(playlists);
            }
        } catch (error) {
            console.error('Error deleting hotspot:', error);
            alert('Error deleting hotspot: ' + error.message);
        }
    }

    // Update preview
    window.updatePreview = function() {
        // Clear existing hotspots and SVG elements
        const existingHotspots = previewContainer.querySelectorAll('.hotspot');
        const existingSvg = previewContainer.querySelector('svg');
        if (existingSvg) existingSvg.remove();
        existingHotspots.forEach(hotspot => hotspot.remove());
        
        // Get the aerial video element
        const aerialVideo = document.getElementById('previewVideo');
        let videoWidth = 1920;
        let videoHeight = 1080;
        
        if (aerialVideo) {
            // If video is loaded, use its dimensions
            if (aerialVideo.videoWidth && aerialVideo.videoHeight) {
                videoWidth = aerialVideo.videoWidth;
                videoHeight = aerialVideo.videoHeight;
            } else {
                // If video dimensions aren't available yet, wait for metadata
                aerialVideo.addEventListener('loadedmetadata', () => {
                    videoWidth = aerialVideo.videoWidth;
                    videoHeight = aerialVideo.videoHeight;
                    updatePreview(); // Re-render with correct dimensions
                });
            }
        } else {
            console.warn('Aerial video element not found, using default dimensions');
        }
        
        // Calculate the aspect ratio
        const aspectRatio = videoWidth / videoHeight;
        
        // Get the container width
        const containerWidth = previewContainer.clientWidth;
        
        // Calculate the container height based on the aspect ratio
        const containerHeight = containerWidth / aspectRatio;
        
        // Update the preview container dimensions
        previewContainer.style.height = `${containerHeight}px`;
        
        // Create SVG container
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.pointerEvents = 'all';
        svg.style.zIndex = '1000';
        svg.style.width = '100%';
        svg.style.height = '100%';
        
        // Filter hotspots for current house
        const houseHotspots = window.hotspots.filter(h => h.houseId === currentHouse);
        console.log('Rendering hotspots:', JSON.stringify(houseHotspots, null, 2));
        
        // Add polygons for each hotspot
        houseHotspots.forEach(hotspot => {
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
            
            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            
            // Use the points directly as they are already in percentages
            const pointsString = hotspot.points.map(p => `${p.x},${p.y}`).join(' ');
            
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
            polygon.setAttribute('fill', 'rgba(229, 9, 20, 0)'); // Fully transparent
            polygon.setAttribute('stroke', 'none'); // Remove stroke
            polygon.setAttribute('stroke-width', '0');
            polygon.setAttribute('stroke-dasharray', 'none');
            polygon.setAttribute('stroke-linecap', 'none');
            polygon.setAttribute('stroke-linejoin', 'none');
            
            // Add hover effect
            group.addEventListener('mouseover', function() {
                polygon.setAttribute('fill', 'rgba(229, 9, 20, 0.4)');
            });
            
            group.addEventListener('mouseout', function() {
                polygon.setAttribute('fill', 'rgba(229, 9, 20, 0)');
            });
            
            // Add click handler
            group.addEventListener('click', () => {
                // Reset all polygons
                svg.querySelectorAll('polygon').forEach(p => {
                    p.setAttribute('fill', 'rgba(229, 9, 20, 0)');
                    p.setAttribute('stroke-width', '0.5');
                });
                
                // Highlight clicked polygon
                polygon.setAttribute('fill', 'rgba(229, 9, 20, 0.4)');
                polygon.setAttribute('stroke-width', '1');
                
                // Find and scroll to corresponding hotspot in the list
                const hotspotItem = document.querySelector(`[data-hotspot-id="${hotspot._id}"]`);
                if (hotspotItem) {
                    hotspotItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
            
            group.appendChild(polygon);
            svg.appendChild(group);
        });
        
        previewContainer.appendChild(svg);
        
        // Log the final SVG structure
        console.log('Final SVG structure:', svg.innerHTML);
    }

    // Update playlist UI
    function updatePlaylistUI(playlists) {
        console.log('Updating playlist UI with playlists:', playlists);
        console.log('Current playlist house:', currentPlaylistHouse);
        console.log('Current asset house:', currentAssetHouse);
        
        // Update hotspot playlists
        const hotspotPlaylistsContainer = document.getElementById('hotspotPlaylistsContainer');
        if (!hotspotPlaylistsContainer) {
            console.error('Hotspot playlists container not found');
            return;
        }

        // Get primary hotspots for the playlist house
        const primaryHotspots = window.hotspots.filter(h => h.type === 'primary' && h.houseId === currentPlaylistHouse);
        console.log('Primary hotspots for playlists:', primaryHotspots);
        
        // Get available videos for the asset house
        const diveInVideos = assets.filter(asset => asset.type === 'diveIn' && asset.houseId === currentAssetHouse);
        const floorLevelVideos = assets.filter(asset => asset.type === 'floorLevel' && asset.houseId === currentAssetHouse);
        const zoomOutVideos = assets.filter(asset => asset.type === 'zoomOut' && asset.houseId === currentAssetHouse);
        
        console.log('Available videos for playlists:', {
            diveIn: diveInVideos,
            floorLevel: floorLevelVideos,
            zoomOut: zoomOutVideos
        });
        
        // Create playlist UI for each primary hotspot
        hotspotPlaylistsContainer.innerHTML = primaryHotspots.map(hotspot => {
            const hotspotPlaylists = playlists[hotspot._id] || {};
            console.log(`Creating playlist UI for hotspot ${hotspot._id}:`, hotspotPlaylists);
            
            return `
                <div class="card bg-dark mb-3">
                    <div class="card-body">
                        <h5 class="card-title">${hotspot.title}</h5>
                        <div class="mb-3">
                            <label class="form-label">Dive In Video</label>
                            <select class="form-select" id="diveInSelect_${hotspot._id}">
                                <option value="">Select Video</option>
                                ${diveInVideos.map(asset => `
                                    <option value="${asset._id}" 
                                        ${hotspotPlaylists.diveIn?.videoId === asset._id ? 'selected' : ''}>
                                        ${asset.name || 'Unnamed Asset'}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Floor Level Video</label>
                            <select class="form-select" id="floorLevelSelect_${hotspot._id}">
                                <option value="">Select Video</option>
                                ${floorLevelVideos.map(asset => `
                                    <option value="${asset._id}"
                                    ${hotspotPlaylists.floorLevel?.videoId === asset._id ? 'selected' : ''}>
                                    ${asset.name || 'Unnamed Asset'}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Zoom Out Video</label>
                        <select class="form-select" id="zoomOutSelect_${hotspot._id}">
                            <option value="">Select Video</option>
                            ${zoomOutVideos.map(asset => `
                                <option value="${asset._id}"
                                    ${hotspotPlaylists.zoomOut?.videoId === asset._id ? 'selected' : ''}>
                                    ${asset.name || 'Unnamed Asset'}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners for playlist changes
        primaryHotspots.forEach(hotspot => {
            const diveInSelect = document.getElementById(`diveInSelect_${hotspot._id}`);
            const floorLevelSelect = document.getElementById(`floorLevelSelect_${hotspot._id}`);
            const zoomOutSelect = document.getElementById(`zoomOutSelect_${hotspot._id}`);

            if (diveInSelect) {
                diveInSelect.addEventListener('change', () => {
                    updateHotspotPlaylist(hotspot._id, 'diveIn', diveInSelect.value);
                });
            }

            if (floorLevelSelect) {
                floorLevelSelect.addEventListener('change', () => {
                    updateHotspotPlaylist(hotspot._id, 'floorLevel', floorLevelSelect.value);
                });
            }

            if (zoomOutSelect) {
                zoomOutSelect.addEventListener('change', () => {
                    updateHotspotPlaylist(hotspot._id, 'zoomOut', zoomOutSelect.value);
                });
            }
        });
    }

    // Update hotspot playlist
    async function updateHotspotPlaylist(hotspotId, type, videoId) {
        try {
            console.log('Updating playlist for:', {
                hotspotId,
                type,
                videoId,
                currentPlaylistHouse
            });

            const playlists = await loadPlaylists(currentPlaylistHouse);
            console.log('Current playlists before update:', playlists);
            
            // Initialize hotspot playlists if they don't exist
            if (!playlists[hotspotId]) {
                playlists[hotspotId] = {
                    diveIn: { videoId: null },
                    floorLevel: { videoId: null },
                    zoomOut: { videoId: null }
                };
            }

            // Update the specific playlist
            playlists[hotspotId][type] = { videoId };

            // Save updated playlists
            const result = await savePlaylists(currentPlaylistHouse, playlists);
            console.log('Save playlists result:', result);
            
            // Update UI with the result from the server
            updatePlaylistUI(result.playlists || playlists);

            showSuccess(`Updated ${type} playlist for hotspot ${hotspotId}`);
        } catch (error) {
            console.error('Error updating playlist:', error);
            showError('Failed to update playlist: ' + error.message);
        }
    }

    // Add window resize handler
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            updatePreview();
        }, 250); // Debounce resize events
    });

    // Global functions
    async function deleteAsset(assetId) {
        if (!confirm('Are you sure you want to delete this asset?')) {
            return;
        }

        try {
            const response = await fetch(`/api/assets/${assetId}?_=${Date.now()}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete asset');
            }

            // Remove the asset from the table
            const row = document.querySelector(`button[data-asset-id="${assetId}"]`)?.closest('tr');
            if (row) {
                row.remove();
            } else {
                console.warn("Asset row not found in DOM (assetId: " + assetId + ") – skipping UI removal.");
            }

            // Show success message
            const toast = new bootstrap.Toast(document.getElementById('notificationToast'));
            document.getElementById('notificationToast').querySelector('.toast-body').textContent = 'Asset deleted successfully';
            toast.show();

            // Reload assets to update the list
            await loadAssets(currentHouse);
        } catch (error) {
            console.error('Error deleting asset:', error);
            alert('Failed to delete asset. Please try again.');
        }
    }

    // Add event listener for upload asset button
    if (uploadAssetBtn) {
        uploadAssetBtn.addEventListener('click', () => {
            const modal = new bootstrap.Modal(uploadAssetModal);
            modal.show();
        });
    }

    // Add event listener for save asset button
    if (saveAssetBtn) {
        saveAssetBtn.addEventListener('click', async () => {
            if (!uploadAssetForm.checkValidity()) {
                uploadAssetForm.reportValidity();
                return;
            }

            const formData = new FormData();
            const fileInput = document.getElementById('assetFile');
            const typeInput = document.getElementById('assetType');
            
            if (!fileInput.files[0]) {
                uploadToastElement.querySelector('.toast-body').textContent = 'Please select a file to upload';
                uploadToast.show();
                return;
            }

            formData.append('asset', fileInput.files[0]);
            formData.append('type', typeInput.value);
            formData.append('houseId', assetHouseSelector.value);

            try {
                const response = await fetch('/api/assets', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || 'Failed to upload asset');
                }

                // Close modal
                const modal = bootstrap.Modal.getInstance(uploadAssetModal);
                modal.hide();

                // Reset form
                uploadAssetForm.reset();

                // Show success message
                uploadToastElement.querySelector('.toast-body').textContent = 'Asset uploaded successfully!';
                uploadToast.show();

                // Reload assets
                await loadAssets(assetHouseSelector.value);
            } catch (error) {
                console.error('Error uploading asset:', error);
                uploadToastElement.querySelector('.toast-body').textContent = 'Failed to upload asset. Please try again.';
                uploadToast.show();
            }
        });
    }

    // Edit asset
    window.editAsset = function(assetId, currentType) {
        const modal = new bootstrap.Modal(document.getElementById('editAssetModal'));
        document.getElementById('editAssetId').value = assetId;
        document.getElementById('editAssetType').value = currentType;
        modal.show();
    };

    // Add event listener for save edit asset button
    const saveEditAssetBtn = document.getElementById('saveEditAssetBtn');
    if (saveEditAssetBtn) {
        saveEditAssetBtn.addEventListener('click', async () => {
            const assetId = document.getElementById('editAssetId').value;
            const newType = document.getElementById('editAssetType').value;

            try {
                const response = await fetch(`/api/assets/${assetId}?_=${Date.now()}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ type: newType })
                });

                if (!response.ok) {
                    throw new Error('Failed to update asset');
                }

                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('editAssetModal'));
                modal.hide();

                // Show success message
                uploadToastElement.querySelector('.toast-body').textContent = 'Asset updated successfully!';
                uploadToast.show();

                // Reload assets
                await loadAssets(assetHouseSelector.value);
            } catch (error) {
                console.error('Error updating asset:', error);
                uploadToastElement.querySelector('.toast-body').textContent = 'Failed to update asset. Please try again.';
                uploadToast.show();
            }
        });
    }

    function showUploadAssetModal() {
        const modal = document.getElementById('uploadAssetModal');
        const modalInstance = new bootstrap.Modal(modal);
        
        // Store the last focused element before opening modal
        const lastFocusedElement = document.activeElement;
        
        // Remove aria-hidden before showing modal
        modal.removeAttribute('aria-hidden');
        
        // Show modal
        modalInstance.show();
        
        // Focus the first focusable element in the modal
        const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
            firstFocusable.focus();
        }
        
        // Store the last focused element for when modal closes
        modal.dataset.lastFocusedElement = lastFocusedElement;
    }

    function hideUploadAssetModal() {
        const modal = document.getElementById('uploadAssetModal');
        const modalInstance = bootstrap.Modal.getInstance(modal);
        
        // Set aria-hidden before hiding modal
        modal.setAttribute('aria-hidden', 'true');
        
        // Hide modal
        modalInstance.hide();
        
        // Restore focus to the last focused element
        const lastFocusedElement = modal.dataset.lastFocusedElement;
        if (lastFocusedElement) {
            lastFocusedElement.focus();
        }
    }

    // Update event listeners for modal
    document.addEventListener('DOMContentLoaded', function() {
        const uploadAssetModal = document.getElementById('uploadAssetModal');
        
        // Handle modal show event
        uploadAssetModal.addEventListener('show.bs.modal', function() {
            // Remove aria-hidden when modal is about to show
            this.removeAttribute('aria-hidden');
        });
        
        // Handle modal hidden event
        uploadAssetModal.addEventListener('hidden.bs.modal', function() {
            // Set aria-hidden when modal is hidden
            this.setAttribute('aria-hidden', 'true');
            
            // Restore focus
            const lastFocusedElement = this.dataset.lastFocusedElement;
            if (lastFocusedElement) {
                lastFocusedElement.focus();
            }
        });
        
        // Handle escape key
        uploadAssetModal.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                hideUploadAssetModal();
            }
        });
    });

    // Update the save asset button click handler
    document.getElementById('saveAssetBtn').addEventListener('click', async function() {
        // ... existing save asset code ...
        
        // After successful save, properly hide the modal
        hideUploadAssetModal();
    });

    // Update hotspot videos UI
    function updateHotspotVideosUI(hotspotVideos) {
        const container = document.getElementById('hotspotPlaylistsContainer');
        if (!container) return;

        // Get primary hotspots for current house
        const primaryHotspots = window.hotspots.filter(h => 
            h.houseId === currentHouse && h.type === 'primary'
        );

        // Get available videos for hotspot section
        const diveInVideos = assets.filter(asset => asset.type === 'diveIn');
        const floorLevelVideos = assets.filter(asset => asset.type === 'floorLevel');
        const zoomOutVideos = assets.filter(asset => asset.type === 'zoomOut');

        container.innerHTML = primaryHotspots.map(hotspot => {
            const hotspotVideo = hotspotVideos.find(v => v.hotspotId === hotspot._id) || {};
            
            return `
                <div class="card bg-dark mb-3">
                    <div class="card-body">
                        <h5 class="card-title">${hotspot.title}</h5>
                        <div class="mb-3">
                            <label class="form-label">Dive In Video</label>
                            <select class="form-select" id="diveInSelect_${hotspot._id}">
                                <option value="">Select Video</option>
                                ${diveInVideos.map(asset => `
                                    <option value="${asset._id}" 
                                        ${hotspotVideo.diveIn?.videoId === asset._id ? 'selected' : ''}>
                                        ${asset.name || 'Unnamed Asset'}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Floor Level Video</label>
                            <select class="form-select" id="floorLevelSelect_${hotspot._id}">
                                <option value="">Select Video</option>
                                ${floorLevelVideos.map(asset => `
                                    <option value="${asset._id}"
                                    ${hotspotVideo.floorLevel?.videoId === asset._id ? 'selected' : ''}>
                                    ${asset.name || 'Unnamed Asset'}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                        <div class="mb-3">
                            <label class="form-label">Zoom Out Video</label>
                            <select class="form-select" id="zoomOutSelect_${hotspot._id}">
                                <option value="">Select Video</option>
                                ${zoomOutVideos.map(asset => `
                                    <option value="${asset._id}"
                                        ${hotspotVideo.zoomOut?.videoId === asset._id ? 'selected' : ''}>
                                        ${asset.name || 'Unnamed Asset'}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners for hotspot video changes
        primaryHotspots.forEach(hotspot => {
            const diveInSelect = document.getElementById(`diveInSelect_${hotspot._id}`);
            const floorLevelSelect = document.getElementById(`floorLevelSelect_${hotspot._id}`);
            const zoomOutSelect = document.getElementById(`zoomOutSelect_${hotspot._id}`);

            const updateHotspotVideos = async (field, value) => {
                try {
                    const currentVideos = {
                        diveIn: { videoId: diveInSelect?.value || '' },
                        floorLevel: { videoId: floorLevelSelect?.value || '' },
                        zoomOut: { videoId: zoomOutSelect?.value || '' }
                    };
                    currentVideos[field] = { videoId: value };

                    const response = await fetch('/api/hotspot-videos', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            houseId: currentHouse,
                            hotspotId: hotspot._id,
                            videos: currentVideos
                        })
                    });
                    if (!response.ok) throw new Error('Failed to update hotspot videos');
                    showNotification('Hotspot videos updated successfully');
                } catch (error) {
                    console.error('Error updating hotspot videos:', error);
                    showNotification('Error updating hotspot videos', 'error');
                }
            };

            if (diveInSelect) {
                diveInSelect.addEventListener('change', () => updateHotspotVideos('diveIn', diveInSelect.value));
            }

            if (floorLevelSelect) {
                floorLevelSelect.addEventListener('change', () => updateHotspotVideos('floorLevel', floorLevelSelect.value));
            }

            if (zoomOutSelect) {
                zoomOutSelect.addEventListener('change', () => updateHotspotVideos('zoomOut', zoomOutSelect.value));
            }
        });
    }

    // Save hotspots
    async function saveHotspots() {
        try {
            // Get current hotspots for the house
            const currentHotspots = window.hotspots.filter(h => h.houseId === currentHouse);
            
            // Save to server
            const response = await fetch('/api/hotspots', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    houseId: currentHouse,
                    hotspots: currentHotspots
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save hotspots');
            }

            const result = await response.json();
            console.log('Saved hotspots:', result);
            return result;
        } catch (error) {
            console.error('Error saving hotspots:', error);
            throw error;
        }
    }

    // Initialize hotspot videos
    async function initializeHotspotVideos(hotspotId) {
        try {
            // Create initial video structure
            const initialVideos = {
                diveIn: { videoId: null },
                floorLevel: { videoId: null },
                zoomOut: { videoId: null }
            };

            // Save to server
            const response = await fetch('/api/hotspot-videos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    houseId: currentHouse,
                    hotspotId: hotspotId,
                    videos: initialVideos
                })
            });

            if (!response.ok) {
                throw new Error('Failed to initialize hotspot videos');
            }

            console.log('Initialized videos for hotspot:', hotspotId);
            return await response.json();
        } catch (error) {
            console.error('Error initializing hotspot videos:', error);
            throw error;
        }
    }

    // Modify the house selection handler
    function handleHouseSelection(houseId) {
        currentHouseId = houseId;
        
        // Update UI to show selected house
        document.querySelectorAll('.house-selector button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.houseId === houseId.toString());
        });

        // Load house-specific data
        loadHotspots(houseId);
        loadHouseVideos(houseId);
        
        // Load global videos (without house context)
        loadGlobalVideos();
    }

    // Modify loadGlobalVideos to not depend on house selection
    async function loadGlobalVideos() {
        try {
            const response = await fetch(`/api/global-videos?_=${Date.now()}`);
            if (!response.ok) throw new Error('Failed to load global videos');
            
            const { globalVideos } = await response.json();
            console.log('Loaded global videos:', globalVideos);

            // Update UI for each global video type
            Object.entries(globalVideos).forEach(([type, video]) => {
                const container = document.getElementById(`${type}-video-container`);
                if (!container) return;

                const select = container.querySelector('select');
                const preview = container.querySelector('.video-preview');
                const nameDisplay = container.querySelector('.selected-video-name');
                
                if (select && video?.videoId) {
                    // Set the selected video
                    select.value = video.videoId;
                    
                    // Update preview and name
                    if (preview) {
                        preview.src = `/api/assets/video/${video.videoId}`;
                        preview.style.display = 'block';
                    }
                    if (nameDisplay) {
                        nameDisplay.textContent = video.name || 'Selected Video';
                        nameDisplay.style.display = 'block';
                    }
                } else {
                    // Reset if no video selected
                    if (select) select.value = '';
                    if (preview) {
                        preview.src = '';
                        preview.style.display = 'none';
                    }
                    if (nameDisplay) {
                        nameDisplay.textContent = '';
                        nameDisplay.style.display = 'none';
                    }
                }
            });
        } catch (error) {
            console.error('Error loading global videos:', error);
            showError('Failed to load global videos');
        }
    }

    // Add showError function at the top with other utility functions
    function showError(message) {
        const notification = document.createElement('div');
        notification.className = 'alert alert-danger';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            padding: 15px 20px;
            border-radius: 4px;
            background-color: #dc3545;
            color: white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease-out;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    // Add showSuccess function for consistency
    function showSuccess(message) {
        const notification = document.createElement('div');
        notification.className = 'alert alert-success';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            padding: 15px 20px;
            border-radius: 4px;
            background-color: #28a745;
            color: white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease-out;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    // Add CSS for animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}); 