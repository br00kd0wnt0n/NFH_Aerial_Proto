// Global functions for the admin panel

// Global variables
window.hotspots = [];

// Delete hotspot function
window.deleteHotspot = async function(hotspotId) {
    if (!confirm('Are you sure you want to delete this hotspot?')) return;

    try {
        // First, get the hotspot from the local array
        const hotspot = window.hotspots.find(h => h._id === hotspotId);
        if (!hotspot) {
            throw new Error('Hotspot not found');
        }

        const response = await fetch(`/api/hotspots/${hotspotId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete hotspot');
        }

        // Remove from local array
        window.hotspots = window.hotspots.filter(h => h._id !== hotspotId);
        
        // Update UI
        if (typeof window.updateHotspotList === 'function') {
            window.updateHotspotList();
        }
        if (typeof window.updatePreview === 'function') {
            window.updatePreview();
        }

        // Show success message
        const toast = new bootstrap.Toast(document.getElementById('notificationToast'));
        document.getElementById('notificationToast').querySelector('.toast-body').textContent = 'Hotspot deleted successfully';
        toast.show();
    } catch (error) {
        console.error('Error deleting hotspot:', error);
        alert('Error deleting hotspot: ' + error.message);
    }
} 