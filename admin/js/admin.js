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
    
    // Global variables
    let hotspots = [];
    let currentHouse = 1; // Set default house ID
    let editingHotspotId = null;
    let assetTypes = null;
    let assets = []; // Add global assets array

    // Initialize DOM elements
    const hotspotModal = new bootstrap.Modal(document.getElementById('hotspotModal'));
    const hotspotForm = document.getElementById('hotspotForm');
    const addHotspotBtn = document.getElementById('addHotspotBtn');
    const saveHotspotBtn = document.getElementById('saveHotspotBtn');
    const previewContainer = document.querySelector('.preview-container');
    const hotspotList = document.querySelector('.hotspot-list');
    const houseSelector = document.getElementById('houseSelector');
    const assetHouseSelector = document.getElementById('assetHouseSelector');
    const assetForm = document.getElementById('assetForm');
    const startDrawingBtn = document.getElementById('startDrawing');
    const finishDrawingBtn = document.getElementById('finishDrawing');
    const cancelDrawingBtn = document.getElementById('cancelDrawing');
    const assetTypeSelect = document.getElementById('assetType');
    const hotspotIdContainer = document.getElementById('hotspotIdContainer');

    // Drawing state
    let isDrawing = false;
    let currentPoints = [];
    let currentHotspot = null;

    // Navigation event handlers
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetSection = button.dataset.section;
            sections.forEach(section => {
                section.style.display = section.id === `${targetSection}Section` ? 'block' : 'none';
            });
            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Load hotspots when switching to Assets section
            if (targetSection === 'assets') {
                loadHotspots(currentHouse);
                loadAssets(currentHouse);
            }
            // Load playlists when switching to Playlists section
            else if (targetSection === 'playlists') {
                loadPlaylists(currentHouse).then(playlists => {
                    updatePlaylistUI(playlists);
                });
            }
            // Refresh hotspot positions when switching to Hotspots section
            else if (targetSection === 'hotspots') {
                loadHotspots(currentHouse).then(() => {
                    updateHotspotList();
                    updatePreview();
                });
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
            const response = await fetch('/api/reload', {
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
    houseSelector.addEventListener('change', async (e) => {
        const newHouseId = parseInt(e.target.value);
        console.log('House selector changed to:', newHouseId);
        currentHouse = newHouseId;
        try {
            await loadHotspots(newHouseId);
            await loadAerialVideo(newHouseId);
        } catch (error) {
            console.error('Error loading house data:', error);
        }
    });

    assetHouseSelector.addEventListener('change', async (e) => {
        const houseId = parseInt(e.target.value);
        console.log('Asset house selector changed to:', houseId);
        currentHouse = houseId;
        try {
            await loadHotspots(houseId);
            await loadAssets(houseId);
        } catch (error) {
            console.error('Error loading house assets:', error);
        }
    });

    // Load playlists from server
    async function loadPlaylists(houseId) {
        try {
            const response = await fetch(`/api/playlists?houseId=${houseId}`);
            if (!response.ok) throw new Error('Failed to load playlists');
            const data = await response.json();
            console.log('Raw playlist data:', data);
            return data.playlists || {};
        } catch (error) {
            console.error('Error loading playlists:', error);
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
            const response = await fetch(`/api/hotspots?houseId=${houseId}`);
            if (!response.ok) {
                throw new Error('Failed to load hotspots');
            }
            
            const data = await response.json();
            console.log('Loaded hotspots data:', data);
            
            if (!data || !data.hotspots) {
                throw new Error('Invalid response format from server');
            }
            
            hotspots = data.hotspots;
            console.log('Updated hotspots array:', hotspots);
            updateHotspotList();
            updatePreview();
            return hotspots;
        } catch (error) {
            console.error('Error loading hotspots:', error);
            throw error;
        }
    }

    // Load assets from server
    async function loadAssets(houseId) {
        try {
            console.log('Loading assets for house:', houseId);
            const response = await fetch(`/api/assets?houseId=${houseId}`);
            if (!response.ok) throw new Error('Failed to load assets');
            
            const data = await response.json();
            if (!data || !data.assets) throw new Error('Invalid response format');
            
            console.log('Loaded assets:', data.assets);
            assets = data.assets; // Store assets in global array

            // Update assets table
            const tableBody = document.getElementById('assetsTableBody');
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
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteAsset('${asset._id}')">
                            Delete
                        </button>
                    </td>
                </tr>
            `).join('');

            // Initialize video optimization for all videos in the table
            tableBody.querySelectorAll('video').forEach(video => {
                optimizeVideoPlayback(video);
            });

            return assets; // Return assets for use in other functions
        } catch (error) {
            console.error('Error loading assets:', error);
            alert('Failed to load assets. Please refresh the page.');
            return [];
        }
    }

    // Initialize video playlists
    async function initializeVideoPlaylists(houseId) {
        try {
            // Load assets first to ensure we have them for the playlist UI
            await loadAssets(houseId);
            
            const playlists = await loadPlaylists(houseId);
            console.log('Loaded playlists:', playlists);
            
            // Get hotspots for the current house
            const response = await fetch(`/api/hotspots?houseId=${houseId}`);
            if (!response.ok) throw new Error('Failed to load hotspots');
            const data = await response.json();
            const currentHotspots = data.hotspots || [];
            
            // Initialize playlists structure
            const updatedPlaylists = {
                houseId: parseInt(houseId),
                playlists: {}
            };
            
            // Add global playlists
            updatedPlaylists.playlists.global = {
                aerial: { videoId: null },
                zoomOut: { videoId: null }
            };
            
            // Add playlists for each primary hotspot
            currentHotspots.forEach(hotspot => {
                if (hotspot.type === 'primary') {
                    const hotspotId = hotspot._id;
                    updatedPlaylists.playlists[hotspotId] = {
                        diveIn: { videoId: null },
                        floorLevel: { videoId: null }
                    };
                    
                    // If there's existing playlist data, use it
                    if (playlists[hotspotId]) {
                        updatedPlaylists.playlists[hotspotId] = {
                            diveIn: playlists[hotspotId].diveIn || { videoId: null },
                            floorLevel: playlists[hotspotId].floorLevel || { videoId: null }
                        };
                    }
                }
            });
            
            console.log('Updated playlists structure:', updatedPlaylists);
            
            // Save the updated playlists
            await savePlaylists(houseId, updatedPlaylists);
            
            // Update the UI with the new playlists
            updatePlaylistUI(updatedPlaylists.playlists);
            
            return updatedPlaylists;
        } catch (error) {
            console.error('Error initializing video playlists:', error);
            return {};
        }
    }

    // Save playlists
    async function savePlaylists(houseId, playlists) {
        try {
            console.log('Saving playlists:', playlists);
            const response = await fetch(`/api/playlists?houseId=${houseId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(playlists)
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

        const currentHotspots = hotspots.filter(h => h.houseId === parseInt(assetHouseSelector.value) && h.type === 'primary');
        
        // Initialize zone transitions
        zoneTransitionsContainer.innerHTML = currentHotspots.map(hotspot => `
            <div class="col-md-6 mb-3">
                <div class="card bg-dark">
                    <div class="card-body">
                        <h6 class="card-title">${hotspot.title} Zone</h6>
                        <div class="upload-area" id="zoneTransitionUploadArea_${hotspot._id}">
                            <p class="mb-2">Zone Transition Video</p>
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
            // Zone transition upload
            const zoneUploadArea = document.getElementById(`zoneTransitionUploadArea_${hotspot._id}`);
            const zoneInput = document.getElementById(`zoneTransitionUpload_${hotspot._id}`);
            
            if (zoneUploadArea && zoneInput) {
                ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                    zoneUploadArea.addEventListener(eventName, preventDefaults, false);
                });

                ['dragenter', 'dragover'].forEach(eventName => {
                    zoneUploadArea.addEventListener(eventName, () => highlight(zoneUploadArea), false);
                });

                ['dragleave', 'drop'].forEach(eventName => {
                    zoneUploadArea.addEventListener(eventName, () => unhighlight(zoneUploadArea), false);
                });

                zoneUploadArea.addEventListener('drop', (e) => handleDrop(e, { 
                    type: 'zoneTransition', 
                    hotspotId: hotspot._id 
                }), false);
                
                zoneInput.addEventListener('change', (e) => handleFiles(e.target.files, { 
                    type: 'zoneTransition', 
                    hotspotId: hotspot._id 
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
                    hotspotId: hotspot._id 
                }), false);
                
                floorInput.addEventListener('change', (e) => handleFiles(e.target.files, { 
                    type: 'floorLevel', 
                    hotspotId: hotspot._id 
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
            formData.append('type', assetType.type);
            
            if (assetType.type === 'zoneTransition' && assetType.hotspotId) {
                formData.append('hotspotId', assetType.hotspotId);
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
                    const hotspotIndex = hotspots.findIndex(h => h._id === hotspotId);
                    if (hotspotIndex !== -1) {
                        hotspots[hotspotIndex].posX = posX;
                        hotspots[hotspotIndex].posY = posY;
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
        editingHotspotId = null;
        hotspotForm.reset();
        hotspotModal.show();
    });

    // Save hotspot
    saveHotspotBtn.addEventListener('click', () => {
        if (hotspotForm.checkValidity()) {
            const formData = new FormData(hotspotForm);
            const hotspotData = {
                _id: editingHotspotId || Date.now().toString(),
                title: formData.get('title'),
                type: formData.get('type'),
                posX: parseFloat(formData.get('posX')),
                posY: parseFloat(formData.get('posY')),
                description: formData.get('description'),
                houseId: currentHouse
            };

            if (editingHotspotId) {
                const index = hotspots.findIndex(h => h._id === editingHotspotId);
                if (index !== -1) {
                    hotspots[index] = hotspotData;
                }
            } else {
                hotspots.push(hotspotData);
            }

            updateHotspotList();
            updatePreview();
            saveHotspots();
            hotspotModal.hide();
        } else {
            hotspotForm.reportValidity();
        }
    });

    // Update hotspot list
    function updateHotspotList() {
        console.log('Updating hotspot list for house:', currentHouse);
        console.log('Current hotspots array:', hotspots);
        const currentHotspots = hotspots.filter(h => h.houseId === currentHouse);
        console.log('Filtered hotspots for current house:', currentHotspots);
        
        if (!hotspotList) {
            console.error('Hotspot list element not found');
            return;
        }
        
        hotspotList.innerHTML = currentHotspots.map(hotspot => `
            <div class="card bg-dark border-secondary mb-2 ${hotspot.type}">
                <div class="card-body">
                    <h6 class="card-title">${hotspot.title}</h6>
                    <p class="card-text small">Type: ${hotspot.type === 'primary' ? 'Primary (IP Zone)' : 'Secondary (Info Panel)'}</p>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-light edit-hotspot" data-id="${hotspot._id}">Edit</button>
                        <button class="btn btn-sm btn-outline-danger delete-hotspot" data-id="${hotspot._id}">Delete</button>
                    </div>
                </div>
            </div>
        `).join('');

        // Add event listeners for edit and delete buttons
        document.querySelectorAll('.edit-hotspot').forEach(button => {
            button.addEventListener('click', () => {
                const hotspotId = button.dataset.id;
                const hotspot = hotspots.find(h => h._id === hotspotId);
                if (hotspot) {
                    editingHotspotId = hotspotId;
                    document.getElementById('title').value = hotspot.title;
                    document.getElementById('type').value = hotspot.type;
                    document.getElementById('posX').value = hotspot.posX;
                    document.getElementById('posY').value = hotspot.posY;
                    document.getElementById('description').value = hotspot.description || '';
                    hotspotModal.show();
                }
            });
        });

        document.querySelectorAll('.delete-hotspot').forEach(button => {
            button.addEventListener('click', () => {
                if (confirm('Are you sure you want to delete this hotspot?')) {
                    const hotspotId = button.dataset.id;
                    hotspots = hotspots.filter(h => h._id !== hotspotId);
                    updateHotspotList();
                    updatePreview();
                    saveHotspots();
                }
            });
        });
    }

    // Update preview
    function updatePreview() {
        const previewContainer = document.querySelector('.preview-container');
        const hotspotPreview = document.getElementById('hotspotPreview');
        
        if (!previewContainer || !hotspotPreview) {
            console.error('Preview container or hotspot preview not found');
            return;
        }
        
        // Clear only the hotspot preview container
        hotspotPreview.innerHTML = '';
        
        const currentHotspots = hotspots.filter(h => h.houseId === currentHouse);
        console.log('Updating preview with hotspots:', currentHotspots);
        
        // Get container dimensions
        const containerWidth = previewContainer.offsetWidth;
        const containerHeight = previewContainer.offsetHeight;
        
        // Wait for the container to be fully rendered
        requestAnimationFrame(() => {
            currentHotspots.forEach(hotspot => {
                // Ensure position values are within bounds
                const posX = Math.max(0, Math.min(parseFloat(hotspot.posX), 100));
                const posY = Math.max(0, Math.min(parseFloat(hotspot.posY), 100));
                
                // Convert percentage to pixels for initial position
                const x = (posX / 100) * containerWidth;
                const y = (posY / 100) * containerHeight;
                
                console.log(`Creating hotspot ${hotspot.title} at position:`, { x, y, posX, posY });
                
                const hotspotElement = document.createElement('div');
                hotspotElement.className = `hotspot-preview ${hotspot.type}`;
                hotspotElement.setAttribute('data-id', hotspot._id);
                hotspotElement.setAttribute('data-x', x);
                hotspotElement.setAttribute('data-y', y);
                hotspotElement.style.transform = `translate(${x}px, ${y}px)`;
                hotspotElement.textContent = hotspot.title;
                
                hotspotPreview.appendChild(hotspotElement);
            });

            // Reinitialize interact.js for new hotspots
            interact('.hotspot-preview').draggable({
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
                        const hotspotIndex = hotspots.findIndex(h => h._id === hotspotId);
                        if (hotspotIndex !== -1) {
                            hotspots[hotspotIndex].posX = posX;
                            hotspots[hotspotIndex].posY = posY;
                            updateHotspotList();
                            saveHotspots();
                        }
                    }
                }
            });
        });
    }

    // Save hotspots to server
    async function saveHotspots() {
        try {
            const currentHotspots = hotspots.filter(h => h.houseId === currentHouse);
            const formattedHotspots = currentHotspots.map(hotspot => ({
                title: hotspot.title,
                type: hotspot.type,
                posX: parseFloat(hotspot.posX),
                posY: parseFloat(hotspot.posY),
                description: hotspot.description || '',
                houseId: parseInt(hotspot.houseId)
            }));

            const response = await fetch('/api/hotspots', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    houseId: currentHouse,
                    hotspots: formattedHotspots
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save hotspots');
            }
            
            const data = await response.json();
            hotspots = data.hotspots;
            updateHotspotList();
            updatePreview();
        } catch (error) {
            console.error('Error saving hotspots:', error);
            alert('Failed to save hotspots. Please try again.');
        }
    }

    // Asset Management
    const uploadAssetBtn = document.getElementById('uploadAssetBtn');
    const uploadAssetModal = new bootstrap.Modal(document.getElementById('uploadAssetModal'));
    const uploadAssetForm = document.getElementById('uploadAssetForm');
    const saveAssetBtn = document.getElementById('saveAssetBtn');

    // Upload Asset button handler
    uploadAssetBtn.addEventListener('click', () => {
        uploadAssetForm.reset();
        uploadAssetModal.show();
    });

    // Save Asset button handler
    saveAssetBtn.addEventListener('click', async () => {
        if (!uploadAssetForm.checkValidity()) {
            uploadAssetForm.reportValidity();
            return;
        }

        const formData = new FormData(uploadAssetForm);
        formData.append('houseId', assetHouseSelector.value);
        formData.append('type', formData.get('assetType'));
        
        // Rename the file field to match server expectation
        const file = formData.get('assetFile');
        formData.delete('assetFile');
        formData.append('assetFile', file);

        try {
            saveAssetBtn.disabled = true;
            saveAssetBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Uploading...';

            const response = await fetch('/api/assets', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to upload asset');
            }

            uploadToastElement.querySelector('.toast-body').textContent = 'Asset uploaded successfully!';
            uploadToast.show();
            uploadAssetModal.hide();
            await loadAssets(assetHouseSelector.value);
        } catch (error) {
            console.error('Error uploading asset:', error);
            uploadToastElement.querySelector('.toast-body').textContent = 'Failed to upload asset. Please try again.';
            uploadToast.show();
        } finally {
            saveAssetBtn.disabled = false;
            saveAssetBtn.innerHTML = 'Upload';
        }
    });

    // Delete asset
    window.deleteAsset = async function(assetId) {
        if (!confirm('Are you sure you want to delete this asset?')) return;
        
        try {
            const response = await fetch(`/api/assets/${assetId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete asset');
            }
            
            uploadToastElement.querySelector('.toast-body').textContent = 'Asset deleted successfully!';
            uploadToast.show();
            await loadAssets(assetHouseSelector.value);
        } catch (error) {
            console.error('Error deleting asset:', error);
            uploadToastElement.querySelector('.toast-body').textContent = 'Failed to delete asset. Please try again.';
            uploadToast.show();
        }
    };

    // Load aerial video for preview
    async function loadAerialVideo(houseId) {
        if (!houseId) {
            console.error('No houseId provided to loadAerialVideo');
            return;
        }

        try {
            console.log('Loading aerial video for house:', houseId);
            const response = await fetch(`/api/assets?type=aerial&houseId=${houseId}`);
            if (!response.ok) throw new Error('Failed to load aerial video');
            
            const data = await response.json();
            console.log('Aerial video data:', data);
            
            if (data && data.assets && data.assets.length > 0) {
                const aerialAsset = data.assets.find(asset => asset.type === 'aerial');
                if (aerialAsset) {
                    const previewVideo = document.getElementById('previewVideo');
                    if (previewVideo) {
                        const source = previewVideo.querySelector('source');
                        if (source) {
                            source.src = aerialAsset.url;
                            await previewVideo.load();
                            try {
                                await previewVideo.play();
                                console.log('Aerial video loaded and playing');
                            } catch (error) {
                                console.error('Error playing preview video:', error);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error loading aerial video:', error);
        }
    }

    // Initialize hotspot asset upload
    function initializeHotspotAssets() {
        const uploadArea = document.getElementById('hotspotUploadArea');
        const fileInput = document.getElementById('hotspotUpload');
        const progressBar = document.getElementById('hotspotUploadProgress');

        if (!uploadArea || !fileInput || !progressBar) return;

        // Drag and drop handlers
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleHotspotAssetUpload(files[0]);
            }
        });

        // File input change handler
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleHotspotAssetUpload(e.target.files[0]);
            }
        });
    }

    // Handle hotspot asset upload
    async function handleHotspotAssetUpload(file) {
        const progressBar = document.getElementById('hotspotUploadProgress');
        const progressBarInner = progressBar.querySelector('.progress-bar');
        
        if (!progressBar || !progressBarInner) return;

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'hotspot');
            formData.append('houseId', document.getElementById('houseSelector').value);

            progressBar.classList.remove('d-none');
            progressBarInner.style.width = '0%';

            const response = await fetch('/api/assets', {
                method: 'POST',
                body: formData,
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    progressBarInner.style.width = percentCompleted + '%';
                }
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const result = await response.json();
            console.log('Hotspot asset uploaded:', result);
            
            // Reload assets to show the new upload
            await loadAssets();
        } catch (error) {
            console.error('Error uploading hotspot asset:', error);
            alert('Failed to upload hotspot asset. Please try again.');
        } finally {
            progressBar.classList.add('d-none');
            progressBarInner.style.width = '0%';
        }
    }

    // Video playback optimization
    function optimizeVideoPlayback(video) {
        // Set video attributes for optimal playback
        video.preload = 'auto';
        video.playsInline = true;
        video.muted = true; // Required for autoplay
        
        // Add event listeners for better performance
        video.addEventListener('loadedmetadata', () => {
            // Pre-buffer the video
            video.currentTime = 0;
        });

        video.addEventListener('canplay', () => {
            // Video is ready to play
            console.log('Video ready to play:', video.src);
        });

        // Handle errors
        video.addEventListener('error', (e) => {
            console.error('Video playback error:', e);
        });
    }

    // Initialize video optimization for all videos
    function initializeVideoOptimization() {
        document.querySelectorAll('video').forEach(video => {
            optimizeVideoPlayback(video);
        });
    }

    // Update playlist UI
    function updatePlaylistUI(playlists) {
        const primaryHotspotPlaylists = document.getElementById('primaryHotspotPlaylists');
        const globalVideosContainer = document.getElementById('globalVideosContainer');
        
        if (!primaryHotspotPlaylists || !globalVideosContainer) {
            console.error('Required containers not found');
            return;
        }

        // Get current hotspots
        const currentHotspots = hotspots.filter(h => h.houseId === currentHouse && h.type === 'primary');
        console.log('Updating playlist UI for hotspots:', currentHotspots);
        
        // Update global videos container
        globalVideosContainer.innerHTML = `
            <div class="card bg-dark">
                <div class="card-body">
                    <h6 class="card-title">Global Videos</h6>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label class="form-label">Aerial Map Video</label>
                                <select class="form-select mb-2" id="aerialVideo">
                                    <option value="">Select Aerial Map Video</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label class="form-label">Zoom Out Video</label>
                                <select class="form-select mb-2" id="zoomOutVideo">
                                    <option value="">Select Zoom Out Video</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Update primary hotspot playlists
        primaryHotspotPlaylists.innerHTML = currentHotspots.map(hotspot => `
            <div class="col-md-6 mb-3">
                <div class="card bg-dark">
                    <div class="card-body">
                        <h6 class="card-title">${hotspot.title}</h6>
                        <div class="mb-3">
                            <label class="form-label">Dive In Video</label>
                            <select class="form-select mb-2" id="diveInVideo_${hotspot._id}">
                                <option value="">Select Dive In Video</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Floor Level Video</label>
                            <select class="form-select mb-2" id="floorLevelVideo_${hotspot._id}">
                                <option value="">Select Floor Level Video</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        // Populate global video selectors
        const aerialSelect = document.getElementById('aerialVideo');
        const zoomOutSelect = document.getElementById('zoomOutVideo');
        
        if (aerialSelect && zoomOutSelect) {
            // Get global playlist
            const globalPlaylist = playlists.global || {};
            console.log('Global playlist:', globalPlaylist);
            
            // Populate aerial videos
            const aerialVideos = assets.filter(a => a.type === 'aerial');
            aerialVideos.forEach(video => {
                const option = document.createElement('option');
                option.value = video._id;
                option.textContent = video.name || 'Unnamed Video';
                if (globalPlaylist.aerial && globalPlaylist.aerial.videoId === video._id) {
                    option.selected = true;
                }
                aerialSelect.appendChild(option);
            });
            
            // Populate zoom out videos
            const zoomOutVideos = assets.filter(a => a.type === 'zoomOut');
            zoomOutVideos.forEach(video => {
                const option = document.createElement('option');
                option.value = video._id;
                option.textContent = video.name || 'Unnamed Video';
                if (globalPlaylist.zoomOut && globalPlaylist.zoomOut.videoId === video._id) {
                    option.selected = true;
                }
                zoomOutSelect.appendChild(option);
            });
            
            // Add change event listeners for global videos
            aerialSelect.addEventListener('change', () => updateGlobalPlaylist('aerial', aerialSelect.value));
            zoomOutSelect.addEventListener('change', () => updateGlobalPlaylist('zoomOut', zoomOutSelect.value));
        }

        // Populate hotspot video selectors
        currentHotspots.forEach(hotspot => {
            const diveInSelect = document.getElementById(`diveInVideo_${hotspot._id}`);
            const floorLevelSelect = document.getElementById(`floorLevelVideo_${hotspot._id}`);
            
            if (diveInSelect && floorLevelSelect) {
                // Get current playlist for this hotspot
                const playlist = playlists[hotspot._id] || {};
                console.log(`Playlist for hotspot ${hotspot._id}:`, playlist);
                
                // Populate dive-in videos
                const diveInVideos = assets.filter(a => a.type === 'diveIn');
                diveInVideos.forEach(video => {
                    const option = document.createElement('option');
                    option.value = video._id;
                    option.textContent = video.name || 'Unnamed Video';
                    if (playlist.diveIn && playlist.diveIn.videoId === video._id) {
                        option.selected = true;
                    }
                    diveInSelect.appendChild(option);
                });
                
                // Populate floor level videos
                const floorLevelVideos = assets.filter(a => a.type === 'floorLevel');
                floorLevelVideos.forEach(video => {
                    const option = document.createElement('option');
                    option.value = video._id;
                    option.textContent = video.name || 'Unnamed Video';
                    if (playlist.floorLevel && playlist.floorLevel.videoId === video._id) {
                        option.selected = true;
                    }
                    floorLevelSelect.appendChild(option);
                });
                
                // Add change event listeners
                diveInSelect.addEventListener('change', () => updatePlaylist(hotspot._id, 'diveIn', diveInSelect.value));
                floorLevelSelect.addEventListener('change', () => updatePlaylist(hotspot._id, 'floorLevel', floorLevelSelect.value));
            }
        });
    }

    // Update global playlist
    async function updateGlobalPlaylist(type, videoId) {
        try {
            const playlists = await loadPlaylists(currentHouse);
            if (!playlists.global) {
                playlists.global = {
                    aerial: { videoId: null },
                    zoomOut: { videoId: null }
                };
            }
            
            playlists.global[type] = { videoId };
            
            await savePlaylists(currentHouse, {
                houseId: currentHouse,
                playlists: playlists
            });
            
            console.log(`Updated ${type} video in global playlist`);
        } catch (error) {
            console.error('Error updating global playlist:', error);
        }
    }

    // Update playlist for a hotspot
    async function updatePlaylist(hotspotId, type, videoId) {
        try {
            const playlists = await loadPlaylists(currentHouse);
            if (!playlists[hotspotId]) {
                playlists[hotspotId] = {
                    diveIn: { videoId: null },
                    floorLevel: { videoId: null }
                };
            }
            
            playlists[hotspotId][type] = { videoId };
            
            await savePlaylists(currentHouse, {
                houseId: currentHouse,
                playlists: playlists
            });
            
            console.log(`Updated ${type} video for hotspot ${hotspotId}`);
        } catch (error) {
            console.error('Error updating playlist:', error);
        }
    }

    // Add event listener for playlist house selector
    const playlistHouseSelector = document.getElementById('playlistHouseSelector');
    if (playlistHouseSelector) {
        playlistHouseSelector.addEventListener('change', async (e) => {
            const houseId = parseInt(e.target.value);
            currentHouse = houseId;
            try {
                const playlists = await loadPlaylists(houseId);
                updatePlaylistUI(playlists);
            } catch (error) {
                console.error('Error loading playlists:', error);
            }
        });
    }

    // Drawing Functions
    startDrawingBtn.addEventListener('click', startDrawing);
    finishDrawingBtn.addEventListener('click', finishDrawing);
    cancelDrawingBtn.addEventListener('click', cancelDrawing);
    previewContainer.addEventListener('click', handlePreviewClick);
    assetTypeSelect.addEventListener('change', handleAssetTypeChange);

    // Initialize
    loadHotspots();

    function startDrawing() {
        isDrawing = true;
        currentPoints = [];
        startDrawingBtn.disabled = true;
        finishDrawingBtn.disabled = false;
        cancelDrawingBtn.disabled = false;
        previewContainer.style.cursor = 'crosshair';
    }

    function finishDrawing() {
        if (currentPoints.length < 3) {
            alert('Please draw at least 3 points to create a polygon');
            return;
        }
        
        isDrawing = false;
        startDrawingBtn.disabled = false;
        finishDrawingBtn.disabled = true;
        cancelDrawingBtn.disabled = true;
        previewContainer.style.cursor = 'default';
        
        // Create hotspot data
        const hotspotData = {
            title: document.getElementById('hotspotTitle').value,
            type: document.getElementById('hotspotType').value,
            points: currentPoints,
            description: document.getElementById('hotspotDescription').value,
            houseId: parseInt(document.getElementById('houseId').value)
        };
        
        // Save hotspot
        saveHotspot(hotspotData);
    }

    function cancelDrawing() {
        isDrawing = false;
        currentPoints = [];
        startDrawingBtn.disabled = false;
        finishDrawingBtn.disabled = true;
        cancelDrawingBtn.disabled = true;
        previewContainer.style.cursor = 'default';
        updatePreview();
    }

    function handlePreviewClick(e) {
        if (!isDrawing) return;
        
        const rect = previewContainer.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        currentPoints.push({ x, y });
        updatePreview();
    }

    function handleAssetTypeChange() {
        const isHotspot = assetTypeSelect.value === 'hotspot';
        hotspotIdContainer.style.display = isHotspot ? 'block' : 'none';
    }

    // Hotspot Management
    async function saveHotspot(hotspotData) {
        try {
            const response = await fetch('/api/hotspots', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(hotspotData)
            });
            
            if (!response.ok) {
                throw new Error('Failed to save hotspot');
            }
            
            await loadHotspots();
            hotspotForm.reset();
            currentPoints = [];
            updatePreview();
        } catch (error) {
            console.error('Error saving hotspot:', error);
            alert('Failed to save hotspot. Please try again.');
        }
    }

    // Initial load
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
}); 