import { authClient } from "./auth-client.js";

// Application state
const state = {
  session: null,
  projectId: null,
  currentPlanId: null,
  currentJobId: null,
  sheets: [],
  currentSheetIndex: 0,
  viewer: null,
  pollInterval: null,
  plans: [],
  currentView: 'planList'
};

// DOM elements
const elements = {
  userInfo: document.getElementById('user-info'),
  planListSection: document.getElementById('plan-list-section'),
  planGrid: document.getElementById('plan-grid'),
  emptyState: document.getElementById('empty-state'),
  newPlanBtn: document.getElementById('new-plan-btn'),
  backToPlansUpload: document.getElementById('back-to-plans-upload'),
  backToPlansViewer: document.getElementById('back-to-plans-viewer'),
  emptyUploadBtn: document.getElementById('empty-upload-btn'),
  uploadSection: document.getElementById('upload-section'),
  processingSection: document.getElementById('processing-section'),
  viewerSection: document.getElementById('viewer-section'),
  fileInput: document.getElementById('file-input'),
  planName: document.getElementById('plan-name'),
  uploadBtn: document.getElementById('upload-btn'),
  progressFill: document.getElementById('progress-fill'),
  progressText: document.getElementById('progress-text'),
  statusText: document.getElementById('status-text'),
  detailsText: document.getElementById('details-text'),
  sheetTabs: document.getElementById('sheet-tabs'),
  sheetInfo: document.getElementById('sheet-info'),
  osdViewer: document.getElementById('osd-viewer')
};

// API helper with credentials
async function apiCall(endpoint, options = {}) {
  const response = await fetch(endpoint, {
    ...options,
    credentials: 'include'
  });

  if (response.status === 401) {
    window.location.href = '/auth.html';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error: ${response.status} - ${text}`);
  }

  return response;
}

// Check authentication
async function checkAuth() {
  try {
    const session = await authClient.getSession();

    if (!session || !session.data || !session.data.user) {
      window.location.href = '/auth.html';
      return false;
    }

    state.session = session.data;
    displayUserInfo(session.data.user);
    return true;
  } catch (error) {
    console.error('Auth check failed:', error);
    window.location.href = '/auth.html';
    return false;
  }
}

// Display user info
function displayUserInfo(user) {
  elements.userInfo.innerHTML = `
    <span>👤 ${user.name || user.email}</span>
    <button class="sign-out-btn">Sign Out</button>
  `;

  // Add event listener for sign-out button
  const signOutBtn = elements.userInfo.querySelector('.sign-out-btn');
  signOutBtn.addEventListener('click', async () => {
    try {
      await authClient.signOut();
      window.location.href = '/auth.html';
    } catch (error) {
      console.error('Sign out failed:', error);
      alert('Failed to sign out');
    }
  });
}

// Find or create Demo Project
async function ensureDemoProject() {
  if (state.projectId) return state.projectId;

  try {
    console.log('Full session state:', state.session);
    let orgId = state.session.session.activeOrganizationId;
    console.log('Initial orgId from session:', orgId);

    // Debug: check all possible locations
    console.log('session.session:', state.session.session);
    console.log('Looking for activeOrganizationId in:', Object.keys(state.session.session || {}));

    // If no organization, list user's organizations and use the first one
    if (!orgId) {
      console.log('No active organization found. Fetching user organizations...');

      try {
        // List user's organizations
        const listOrgsResponse = await fetch('/api/auth/organization/list', {
          method: 'GET',
          credentials: 'include',
        });

        console.log('List orgs response status:', listOrgsResponse.status);

        if (!listOrgsResponse.ok) {
          const errorText = await listOrgsResponse.text();
          console.error('List orgs error response:', errorText);
          throw new Error(`Failed to list organizations: ${listOrgsResponse.status} - ${errorText}`);
        }

        const orgsData = await listOrgsResponse.json();
        console.log('User organizations:', orgsData);

        if (orgsData && orgsData.length > 0) {
          orgId = orgsData[0].id;
          console.log('Using first organization:', orgId);

          // Set as active organization
          const setActiveResponse = await fetch('/api/auth/organization/set-active', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
              organizationId: orgId
            })
          });

          console.log('Set active org response status:', setActiveResponse.status);

          if (setActiveResponse.ok) {
            // Refresh session to get updated activeOrganizationId
            const session = await authClient.getSession();
            console.log('Refreshed session after setting active org:', session);
            if (session && session.data) {
              state.session = session.data;
              orgId = session.data.session.activeOrganizationId || orgId;
              console.log('Updated orgId from session:', orgId);
            }
          }
        } else {
          console.log('No organizations found for user. Creating one...');

          // Create organization if none exist
          const createOrgResponse = await fetch('/api/auth/organization/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
              name: 'My Organization',
              slug: 'my-org'
            })
          });

          if (createOrgResponse.ok) {
            const orgData = await createOrgResponse.json();
            orgId = orgData.id;
            console.log('Created organization:', orgData);
          }
        }
      } catch (orgError) {
        console.error('Failed to setup organization:', orgError);
        alert('Failed to setup organization. Please try again.');
        throw orgError;
      }
    }

    console.log('Final orgId before listing projects:', orgId);

    if (!orgId) {
      throw new Error('Organization ID is still null after creation attempt');
    }

    // List existing projects
    console.log('Fetching projects from:', `/api/projects/organizations/${orgId}/projects`);
    const response = await apiCall(`/api/projects/organizations/${orgId}/projects`);
    const data = await response.json();

    // Find Demo Project
    const demoProject = data.projects?.find(p => p.name === 'Demo Project');

    if (demoProject) {
      state.projectId = demoProject.id;
      console.log('Using existing Demo Project:', state.projectId);
      return state.projectId;
    }

    // Create Demo Project
    const createResponse = await apiCall('/api/projects/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Demo Project',
        description: 'Auto-created project for demo uploads'
      })
    });

    const createData = await createResponse.json();
    state.projectId = createData.projectId;
    console.log('Created Demo Project:', state.projectId);
    return state.projectId;
  } catch (error) {
    console.error('Failed to ensure Demo Project:', error);
    alert('Failed to create/find Demo Project. Please try again.');
    throw error;
  }
}

// Handle file selection
elements.fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  elements.uploadBtn.disabled = !file;
});

// Handle upload
elements.uploadBtn.addEventListener('click', async () => {
  const file = elements.fileInput.files[0];
  if (!file) return;

  try {
    elements.uploadBtn.disabled = true;
    elements.uploadBtn.textContent = 'Uploading...';

    // Ensure project exists
    const projectId = await ensureDemoProject();

    // Build form data
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', elements.planName.value || file.name);

    // Upload
    const response = await apiCall(`/api/projects/${projectId}/plans`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    console.log('Upload successful:', data);

    state.currentPlanId = data.planId;
    state.currentJobId = data.jobId;

    // Refresh plan list
    await loadPlans();

    // Show processing section
    showProcessingSection();
    startPolling();

  } catch (error) {
    console.error('Upload failed:', error);
    alert('Upload failed: ' + error.message);
    elements.uploadBtn.disabled = false;
    elements.uploadBtn.textContent = 'Upload Plan';
  }
});

// Show processing section
function showProcessingSection() {
  hideAllSections();
  elements.processingSection.style.display = 'block';
  state.currentView = 'processing';
}

// Start polling job status
function startPolling() {
  if (state.pollInterval) {
    clearInterval(state.pollInterval);
  }

  pollJobStatus(); // Poll immediately

  state.pollInterval = setInterval(pollJobStatus, 2000); // Poll every 2s
}

// Poll job status
async function pollJobStatus() {
  try {
    const response = await apiCall(`/api/processing/jobs/${state.currentJobId}`);
    const job = await response.json();

    console.log('Job status:', job);

    // Update progress
    const progress = job.progress || 0;
    elements.progressFill.style.width = `${progress}%`;
    elements.progressText.textContent = `${Math.round(progress)}%`;

    // Update status
    let statusText = '';
    switch (job.status) {
      case 'pending':
        statusText = 'Waiting to start...';
        break;
      case 'processing':
        statusText = `Processing: ${job.completedPages || 0}/${job.totalPages || '?'} pages`;
        break;
      case 'complete':
        statusText = 'Complete!';
        break;
      case 'failed':
        statusText = 'Failed';
        break;
      default:
        statusText = job.status;
    }
    elements.statusText.textContent = statusText;

    // Update details
    if (job.totalPages) {
      elements.detailsText.innerHTML = `
        <p>Total Pages: ${job.totalPages}</p>
        <p>Completed: ${job.completedPages || 0}</p>
        ${job.failedPages ? `<p class="error">Failed: ${JSON.parse(job.failedPages).length}</p>` : ''}
      `;
    }

    // Check if complete
    if (job.status === 'complete') {
      clearInterval(state.pollInterval);
      state.pollInterval = null;
      setTimeout(() => loadSheets(), 1000); // Wait 1s then load sheets
    } else if (job.status === 'failed') {
      clearInterval(state.pollInterval);
      state.pollInterval = null;
      alert('Processing failed: ' + (job.lastError || 'Unknown error'));
    }

  } catch (error) {
    console.error('Polling failed:', error);
    // Continue polling on network errors
  }
}

// Load sheets
async function loadSheets() {
  try {
    const response = await apiCall(`/api/plans/${state.currentPlanId}/sheets`);
    const data = await response.json();

    state.sheets = data.sheets || [];
    console.log('Loaded sheets:', state.sheets);

    if (state.sheets.length === 0) {
      alert('No sheets found. Processing may still be in progress.');
      return;
    }

    // Show viewer section
    showViewerSection();
    
    // Calculate and display total marker count in header
    const totalMarkers = state.sheets.reduce((sum, sheet) => {
      return sum + (sheet.markerCount || 0);
    }, 0);
    const header = elements.viewerSection.querySelector('.section-header h2');
    if (header) {
      if (totalMarkers > 0) {
        header.textContent = `Plan Sheets (${totalMarkers} references detected)`;
      } else {
        header.textContent = 'Plan Sheets';
      }
    }
    
    renderSheetTabs();
    selectSheet(0);

  } catch (error) {
    console.error('Failed to load sheets:', error);
    alert('Failed to load sheets: ' + error.message);
  }
}

// Show viewer section
function showViewerSection() {
  hideAllSections();
  elements.viewerSection.style.display = 'block';
  state.currentView = 'viewer';
}

// Render sheet tabs
function renderSheetTabs() {
  elements.sheetTabs.innerHTML = state.sheets.map((sheet, index) => {
    const isActive = index === state.currentSheetIndex;
    const isReady = sheet.processingStatus === 'ready';
    const label = sheet.sheetName || `Sheet ${sheet.pageNumber}`;
    const markerCount = sheet.markerCount !== undefined ? sheet.markerCount : null;
    const markerBadge = markerCount !== null && markerCount > 0 ? ` (${markerCount} refs)` : '';

    return `
      <button
        class="sheet-tab ${isActive ? 'active' : ''} ${!isReady ? 'disabled' : ''}"
        data-index="${index}"
        ${!isReady ? 'disabled' : ''}
      >
        ${label}${markerBadge}
        ${!isReady ? ' (processing...)' : ''}
      </button>
    `;
  }).join('');

  // Add click handlers
  document.querySelectorAll('.sheet-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      selectSheet(index);
    });
  });
}

// Select sheet
function selectSheet(index) {
  state.currentSheetIndex = index;
  const sheet = state.sheets[index];

  if (!sheet) return;

  // Update tabs
  renderSheetTabs();

  // Update sheet info
  elements.sheetInfo.innerHTML = `
    <p><strong>${sheet.sheetName || `Sheet ${sheet.pageNumber}`}</strong></p>
    <p>Size: ${sheet.width || '?'} × ${sheet.height || '?'} px</p>
    <p>Status: ${sheet.processingStatus}</p>
    <p>Tiles: ${sheet.tileCount || '?'}</p>
    <p>References: ${sheet.markerCount !== undefined ? sheet.markerCount : '?'}</p>
  `;

  // Load tiles
  if (sheet.processingStatus === 'ready') {
    loadTiles(sheet);
  } else {
    elements.osdViewer.innerHTML = '<p class="processing-message">Sheet is still processing...</p>';
  }
}

// Load tiles with OpenSeadragon
function loadTiles(sheet) {
  // Destroy existing viewer
  if (state.viewer) {
    state.viewer.destroy();
    state.viewer = null;
  }

  // Calculate max level
  const maxDimension = Math.max(sheet.width || 2048, sheet.height || 2048);
  const maxLevel = Math.ceil(Math.log2(maxDimension / 256));

  console.log('Loading tiles for sheet:', sheet.id, 'maxLevel:', maxLevel);

  // Create custom tile source
  const tileSource = {
    width: sheet.width || 2048,
    height: sheet.height || 2048,
    tileSize: 256,
    tileOverlap: 0,
    minLevel: 0,
    maxLevel: maxLevel,
    getTileUrl: function(level, x, y) {
      return `/api/plans/${state.currentPlanId}/sheets/${sheet.id}/tiles/${level}/${x}_${y}.jpg`;
    }
  };

  // Initialize OpenSeadragon
  try {
    state.viewer = OpenSeadragon({
      id: 'osd-viewer',
      tileSources: [tileSource],
      showNavigator: true,
      navigatorPosition: 'BOTTOM_RIGHT',
      showNavigationControl: true,
      showHomeControl: true,
      showZoomControl: true,
      showFullPageControl: true,
      prefixUrl: 'https://cdn.jsdelivr.net/npm/openseadragon@4.1/build/openseadragon/images/',
      defaultZoomLevel: 0.5,
      minZoomLevel: 0.5,
      maxZoomLevel: 10,
      visibilityRatio: 0.5,
      constrainDuringPan: true
    });

    state.viewer.addHandler('open-failed', (event) => {
      console.error('Failed to open tiles:', event);
      alert('Failed to load tiles. Please check if tiles were generated.');
    });

    state.viewer.addHandler('tile-load-failed', (event) => {
      console.warn('Tile load failed:', event.tile.url);
    });

    console.log('OpenSeadragon initialized successfully');
  } catch (error) {
    console.error('Failed to initialize OpenSeadragon:', error);
    alert('Failed to initialize viewer: ' + error.message);
  }
}

// Format date to readable string
function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

// Get status badge HTML
function getStatusBadge(status) {
  const badges = {
    complete: '✅ Complete',
    processing: '⏳ Processing',
    pending: '⏱️ Pending',
    failed: '❌ Failed'
  };
  return badges[status] || status;
}

// Load plans from API
async function loadPlans() {
  try {
    const response = await apiCall(`/api/projects/${state.projectId}/plans`);
    const data = await response.json();
    state.plans = data.plans || [];
    renderPlanList();
  } catch (error) {
    console.error('Failed to load plans:', error);
    alert('Failed to load plans: ' + error.message);
  }
}

// Render plan list
function renderPlanList() {
  if (state.plans.length === 0) {
    elements.emptyState.style.display = 'block';
    elements.planGrid.style.display = 'none';
    return;
  }

  elements.emptyState.style.display = 'none';
  elements.planGrid.style.display = 'grid';

  elements.planGrid.innerHTML = state.plans.map(plan => `
    <div class="plan-card" data-plan-id="${plan.id}">
      <div class="plan-icon">📄</div>
      <div class="plan-name">${plan.name}</div>
      <div class="plan-info">
        <span>${formatDate(plan.createdAt)}</span>
        <span class="plan-status status-${plan.processingStatus}">
          ${getStatusBadge(plan.processingStatus)}
        </span>
      </div>
    </div>
  `).join('');

  // Add click listeners to plan cards
  document.querySelectorAll('.plan-card').forEach(card => {
    card.addEventListener('click', () => {
      const planId = card.dataset.planId;
      selectPlan(planId);
    });
  });
}

// Show plan list section
function showPlanListSection() {
  hideAllSections();
  elements.planListSection.style.display = 'block';
  state.currentView = 'planList';
  loadPlans();
}

// Select a plan to view
async function selectPlan(planId) {
  state.currentPlanId = planId;
  const plan = state.plans.find(p => p.id === planId);

  if (!plan) {
    alert('Plan not found');
    return;
  }

  if (plan.processingStatus === 'complete') {
    await loadSheets();
  } else if (plan.processingStatus === 'processing') {
    alert('This plan is still being processed. Please wait for it to complete.');
  } else if (plan.processingStatus === 'failed') {
    alert('This plan failed to process. Please try uploading it again.');
  } else if (plan.processingStatus === 'pending') {
    alert('This plan is waiting to be processed. Please check back shortly.');
  }
}

// Hide all sections
function hideAllSections() {
  elements.planListSection.style.display = 'none';
  elements.uploadSection.style.display = 'none';
  elements.processingSection.style.display = 'none';
  elements.viewerSection.style.display = 'none';
}

// Show upload section
function showUploadSection() {
  hideAllSections();
  elements.uploadSection.style.display = 'block';
  state.currentView = 'upload';
}

// Initialize app
async function init() {
  console.log('Initializing app...');

  const authenticated = await checkAuth();
  if (!authenticated) return;

  await ensureDemoProject();

  // Add event listeners for navigation
  elements.newPlanBtn.addEventListener('click', showUploadSection);
  elements.emptyUploadBtn.addEventListener('click', showUploadSection);
  elements.backToPlansUpload.addEventListener('click', showPlanListSection);
  elements.backToPlansViewer.addEventListener('click', showPlanListSection);

  // Show plan list by default
  showPlanListSection();

  console.log('App initialized. Ready to view plans.');
}

// Start app when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
