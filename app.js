/**
 * MaKo Knowledge Management System - Main Application Script
 *
 * This script handles:
 * - Navigation tree generation and interaction
 * - Document loading and display
 * - Search functionality (title and full-text)
 * - Document upload
 * - Content indexing
 */

// =============================================================================
// Global Variables
// =============================================================================

/** @type {Array} Content index for full-text search */
let contentIndex = [];

/** @type {string} Current search mode: 'title' or 'content' */
let searchMode = 'title';

/** @type {boolean} Whether content indexing is complete */
let indexingComplete = false;

/** @type {Object} Stores all category trees */
const dynamicStructures = {};

// API base URL
const API_BASE_URL = 'http://localhost:5001';

// =============================================================================
// Tree Generation and Navigation
// =============================================================================

/**
 * Generate tree HTML from hierarchical data structure
 * @param {Array} items - Array of tree items
 * @param {HTMLElement} parentElement - Parent DOM element to append to
 */
function generateTree(items, parentElement) {
    items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'tree-item';

        if (item.children && item.children.length > 0) {
            li.classList.add('has-children');
        } else {
            li.classList.add('no-children');
        }

        const label = document.createElement('div');
        label.className = 'tree-label';
        label.innerHTML = `<span class="tree-toggle"></span><span>${item.title}</span>`;

        if (item.file) {
            label.dataset.file = item.file;
            label.addEventListener('click', (e) => {
                e.stopPropagation();
                loadContent(item.file, item.title);
                document.querySelectorAll('.tree-label').forEach(l => l.classList.remove('active'));
                label.classList.add('active');
            });
        } else if (item.children) {
            label.addEventListener('click', (e) => {
                e.stopPropagation();
                li.classList.toggle('expanded');
                const childrenUl = li.querySelector('.tree-children');
                if (childrenUl) {
                    childrenUl.classList.toggle('expanded');
                }
            });
        }

        li.appendChild(label);

        if (item.children && item.children.length > 0) {
            const ul = document.createElement('ul');
            ul.className = 'tree-children';
            generateTree(item.children, ul);
            li.appendChild(ul);
        }

        parentElement.appendChild(li);
    });
}

/**
 * Load document content into iframe
 * @param {string} filepath - Path to the HTML file
 * @param {string} title - Document title
 */
function loadContent(filepath, title) {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = `<iframe src="${filepath}" class="doc-frame" title="${title}"></iframe>`;
}

/**
 * Get or create a dynamic tree section for a category
 * @param {string} categoryName - Name of the category
 * @returns {Object} Tree section object with structure and container
 */
function getOrCreateTreeSection(categoryName) {
    // Check if dynamic section already exists
    if (dynamicStructures[categoryName]) {
        return dynamicStructures[categoryName];
    }

    // Create new dynamic section
    const structure = [];
    const dynamicSections = document.getElementById('dynamicSections');

    // Create section header
    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `${categoryName} <span class="module-badge" style="background-color: #e7f3ff; color: #0056b3;">Section</span>`;

    // Create tree container
    const treeContainer = document.createElement('ul');
    treeContainer.className = 'tree';
    treeContainer.id = `${categoryName.toLowerCase()}Tree`;

    // Append to dynamic sections
    dynamicSections.appendChild(header);
    dynamicSections.appendChild(treeContainer);

    // Store in dynamicStructures
    dynamicStructures[categoryName] = {
        structure: structure,
        container: treeContainer
    };

    console.log(`Created new tree section: ${categoryName}`);
    return dynamicStructures[categoryName];
}

// =============================================================================
// Content Indexing and Search
// =============================================================================

/**
 * Extract text content from HTML string
 * @param {string} html - HTML content
 * @returns {string} Plain text content
 */
function extractTextFromHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    // Remove script and style tags
    const scripts = doc.querySelectorAll('script, style');
    scripts.forEach(s => s.remove());
    return doc.body.textContent || '';
}

/**
 * Build content index for full-text search
 * Fetches all uploaded documents and indexes their content
 */
async function buildContentIndex() {
    const statusEl = document.getElementById('indexingStatus');
    contentIndex = [];

    try {
        // Fetch list of uploaded documents from API
        const response = await fetch(`${API_BASE_URL}/api/scan-uploads`);
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const uploads = data.uploads || [];

        if (uploads.length === 0) {
            statusEl.textContent = 'No documents to index';
            statusEl.classList.add('ready');
            indexingComplete = true;
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 3000);
            return;
        }

        statusEl.textContent = `Indexing ${uploads.length} document${uploads.length !== 1 ? 's' : ''}...`;

        // Fetch and index content in batches
        const batchSize = 5;
        for (let i = 0; i < uploads.length; i += batchSize) {
            const batch = uploads.slice(i, i + batchSize);

            await Promise.all(batch.map(async (upload) => {
                try {
                    const response = await fetch(upload.path);
                    const html = await response.text();
                    const textContent = extractTextFromHTML(html);

                    // Get document title (last item in navigation array)
                    const title = upload.navigation[upload.navigation.length - 1];

                    // Get module (first item in navigation array)
                    const module = upload.navigation[0];

                    contentIndex.push({
                        title: title,
                        file: upload.path,
                        module: module,
                        path: upload.navigation, // Full navigation path
                        content: textContent.toLowerCase()
                    });
                } catch (error) {
                    console.error(`Failed to index ${upload.path}:`, error);
                }
            }));

            statusEl.textContent = `Indexing... ${Math.min(i + batchSize, uploads.length)}/${uploads.length}`;
        }

        indexingComplete = true;
        statusEl.textContent = `✓ ${uploads.length} document${uploads.length !== 1 ? 's' : ''} indexed - Ready to search!`;
        statusEl.classList.add('ready');

        // Hide status after 3 seconds
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);

    } catch (error) {
        console.error('Failed to build content index:', error);
        statusEl.textContent = 'Indexing failed - check console';
        statusEl.style.backgroundColor = '#f8d7da';
        statusEl.style.color = '#721c24';
    }
}

/**
 * Search in content using full-text search
 * @param {string} searchTerm - Search term
 */
function searchContent(searchTerm) {
    if (!indexingComplete) {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <div class="loading-message">
                Please wait, content indexing is in progress...
            </div>
        `;
        return;
    }

    const term = searchTerm.toLowerCase().trim();
    if (term === '') {
        showWelcomeScreen();
        return;
    }

    const results = [];

    contentIndex.forEach(page => {
        const titleMatch = page.title.toLowerCase().includes(term);
        const contentMatch = page.content.includes(term);

        if (titleMatch || contentMatch) {
            // Find snippet with context
            let snippet = '';
            if (contentMatch) {
                const index = page.content.indexOf(term);
                const start = Math.max(0, index - 100);
                const end = Math.min(page.content.length, index + term.length + 100);
                snippet = page.content.substring(start, end).trim();

                // Clean up the snippet
                snippet = snippet.replace(/\s+/g, ' ');
                if (start > 0) snippet = '...' + snippet;
                if (end < page.content.length) snippet = snippet + '...';

                // Highlight the search term
                const regex = new RegExp(`(${term})`, 'gi');
                snippet = snippet.replace(regex, '<span class="search-highlight">$1</span>');
            } else {
                // Title match, get first part of content
                snippet = page.content.substring(0, 200).trim().replace(/\s+/g, ' ') + '...';
            }

            results.push({
                title: page.title,
                file: page.file,
                module: page.module,
                path: page.path.slice(0, -1).join(' > '),
                snippet: snippet,
                matchType: titleMatch ? 'title' : 'content'
            });
        }
    });

    displaySearchResults(results, term);
}

/**
 * Display search results in the content area
 * @param {Array} results - Array of search results
 * @param {string} searchTerm - Original search term
 */
function displaySearchResults(results, searchTerm) {
    const contentArea = document.getElementById('contentArea');

    if (results.length === 0) {
        contentArea.innerHTML = `
            <div class="no-results">
                <h3>No results found</h3>
                <p>No pages match your search for "<strong>${searchTerm}</strong>"</p>
                <p>Try different keywords or search in title mode</p>
            </div>
        `;
        return;
    }

    let html = `
        <div class="search-results">
            <div class="search-results-header">
                <h2>Search Results</h2>
                <div class="search-results-count">
                    Found ${results.length} result${results.length !== 1 ? 's' : ''} for "<strong>${searchTerm}</strong>"
                </div>
            </div>
    `;

    results.forEach(result => {
        html += `
            <div class="search-result-item" onclick="loadContent('${result.file}', '${result.title.replace(/'/g, "\\'")}')">
                <div class="search-result-title">${result.title}</div>
                <div class="search-result-path">${result.module}${result.path ? ' > ' + result.path : ''}</div>
                <div class="search-result-snippet">${result.snippet}</div>
            </div>
        `;
    });

    html += '</div>';
    contentArea.innerHTML = html;
}

/**
 * Show welcome screen
 */
function showWelcomeScreen() {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = `
        <div class="welcome">
            <h2>Welcome to MaKo Knowledge Management</h2>
            <p>Select a documentation page from the navigation tree to view its content</p>
        </div>
    `;
}

/**
 * Filter tree based on title search
 * @param {string} searchTerm - Search term
 */
function filterTree(searchTerm) {
    const allItems = document.querySelectorAll('.tree-item');
    const term = searchTerm.toLowerCase().trim();

    // If search is empty, show everything and collapse
    if (term === '') {
        allItems.forEach(item => {
            item.style.display = 'block';
            item.classList.remove('expanded');
            const childrenUl = item.querySelector('.tree-children');
            if (childrenUl) {
                childrenUl.classList.remove('expanded');
            }
        });
        return;
    }

    // First pass: check which items match
    const matchingItems = new Set();
    allItems.forEach(item => {
        const label = item.querySelector('.tree-label span:last-child');
        const text = label.textContent.toLowerCase();

        if (text.includes(term)) {
            matchingItems.add(item);
        }
    });

    // Second pass: show matching items and their ancestors
    allItems.forEach(item => {
        const label = item.querySelector('.tree-label span:last-child');
        const text = label.textContent.toLowerCase();
        const matches = text.includes(term);

        // Check if any descendant matches
        const hasMatchingDescendant = hasMatchingChild(item, matchingItems);

        if (matches || hasMatchingDescendant) {
            item.style.display = 'block';

            // If this item matches, expand all parents
            if (matches) {
                expandParents(item);
            }

            // If descendant matches, expand this item
            if (hasMatchingDescendant) {
                item.classList.add('expanded');
                const childrenUl = item.querySelector('.tree-children');
                if (childrenUl) {
                    childrenUl.classList.add('expanded');
                }
            }
        } else {
            item.style.display = 'none';
        }
    });

    // Clear content area when filtering tree
    showWelcomeScreen();
}

/**
 * Check if item has matching children
 * @param {HTMLElement} item - Tree item element
 * @param {Set} matchingItems - Set of matching items
 * @returns {boolean}
 */
function hasMatchingChild(item, matchingItems) {
    const children = item.querySelectorAll('.tree-item');
    for (let child of children) {
        if (matchingItems.has(child)) {
            return true;
        }
    }
    return false;
}

/**
 * Expand all parent items in tree
 * @param {HTMLElement} item - Tree item element
 */
function expandParents(item) {
    let parent = item.parentElement;
    while (parent) {
        if (parent.classList.contains('tree-children')) {
            parent.classList.add('expanded');
            const parentItem = parent.parentElement;
            if (parentItem && parentItem.classList.contains('tree-item')) {
                parentItem.classList.add('expanded');
                parentItem.style.display = 'block';
            }
        }
        parent = parent.parentElement;
    }
}

/**
 * Set search mode (title or content)
 * @param {string} mode - 'title' or 'content'
 */
function setSearchMode(mode) {
    searchMode = mode;
    document.getElementById('titleSearchBtn').classList.toggle('active', mode === 'title');
    document.getElementById('contentSearchBtn').classList.toggle('active', mode === 'content');

    const searchBox = document.getElementById('searchBox');
    if (mode === 'title') {
        searchBox.placeholder = 'Search page titles...';
    } else {
        searchBox.placeholder = 'Search page content...';
    }

    // Re-run search with current term
    handleSearch(searchBox.value);
}

/**
 * Handle search based on current mode
 * @param {string} searchTerm - Search term
 */
function handleSearch(searchTerm) {
    if (searchMode === 'title') {
        filterTree(searchTerm);
    } else {
        searchContent(searchTerm);
    }
}

// =============================================================================
// Document Upload
// =============================================================================

/**
 * Load uploaded documents and integrate into tree
 */
async function loadUploadedDocuments() {
    console.log('Loading uploaded documents...');
    try {
        const response = await fetch(`${API_BASE_URL}/api/scan-uploads`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Scan response:', data);

        if (data.uploads && data.uploads.length > 0) {
            console.log(`Found ${data.uploads.length} uploaded documents`);

            data.uploads.forEach(upload => {
                const { navigation, path } = upload;

                // Get or create tree section for the root category
                const rootCategory = navigation[0];
                const treeSection = getOrCreateTreeSection(rootCategory);
                const structure = treeSection.structure;

                // Add to structure
                let currentLevel = structure;
                for (let i = 1; i < navigation.length; i++) {
                    const title = navigation[i];
                    let existingItem = currentLevel.find(item => item.title === title);

                    if (i === navigation.length - 1) {
                        // Document (leaf node)
                        if (!existingItem) {
                            currentLevel.push({
                                title: title,
                                file: path
                            });
                        }
                    } else {
                        // Category/folder
                        if (!existingItem) {
                            existingItem = {
                                title: title,
                                children: []
                            };
                            currentLevel.push(existingItem);
                        }
                        if (!existingItem.children) {
                            existingItem.children = [];
                        }
                        currentLevel = existingItem.children;
                    }
                }
            });

            // Regenerate all dynamic trees
            for (const categoryName in dynamicStructures) {
                const treeSection = dynamicStructures[categoryName];
                treeSection.container.innerHTML = '';
                generateTree(treeSection.structure, treeSection.container);
                console.log(`Regenerated tree for: ${categoryName}`);
            }

            console.log('Uploaded documents integrated into tree');
        } else {
            console.log('No uploaded documents found');
        }
    } catch (error) {
        console.error('Error loading uploaded documents:', error);
        console.error('Make sure Flask server is running on http://localhost:5001/');
    }
}

/**
 * Open upload modal
 */
function openUploadModal() {
    const modal = document.getElementById('uploadModal');
    modal.classList.add('show');

    // Reset upload state
    document.getElementById('uploadStatus').className = 'upload-status';
    document.getElementById('uploadStatus').textContent = '';
    document.getElementById('progressBar').classList.remove('show');
    document.getElementById('fileInput').value = '';
}

/**
 * Close upload modal
 */
function closeUploadModal() {
    const modal = document.getElementById('uploadModal');
    modal.classList.remove('show');
}

/**
 * Handle file selection from input
 * @param {Event} event - File input change event
 */
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        handleFile(file);
    }
}

/**
 * Handle file upload
 * @param {File} file - File object to upload
 */
function handleFile(file) {
    // Validate file type
    if (!file.name.endsWith('.doc')) {
        showUploadStatus('error', 'Invalid file type. Please upload a .doc file.');
        return;
    }

    // Show progress
    showUploadStatus('loading', 'Uploading and converting file...');
    document.getElementById('progressBar').classList.add('show');
    document.getElementById('progressFill').style.width = '50%';

    // Create form data
    const formData = new FormData();
    formData.append('file', file);

    // Upload to server
    fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('progressFill').style.width = '100%';

        if (data.success) {
            showUploadStatus('success', `File uploaded successfully! ${data.images} images extracted.`);

            // Add to navigation tree
            addToNavigationTree(data);

            // Close modal after 2 seconds
            setTimeout(() => {
                closeUploadModal();
                // Load the new page
                loadContent(data.html_path, data.navigation[data.navigation.length - 1]);
            }, 2000);
        } else {
            showUploadStatus('error', `Upload failed: ${data.error}`);
        }
    })
    .catch(error => {
        console.error('Upload error:', error);
        showUploadStatus('error', `Upload failed: ${error.message}`);
    })
    .finally(() => {
        setTimeout(() => {
            document.getElementById('progressBar').classList.remove('show');
        }, 1000);
    });
}

/**
 * Show upload status message
 * @param {string} type - 'success', 'error', or 'loading'
 * @param {string} message - Status message
 */
function showUploadStatus(type, message) {
    const statusDiv = document.getElementById('uploadStatus');
    statusDiv.className = `upload-status ${type}`;
    statusDiv.textContent = message;
}

/**
 * Add uploaded document to navigation tree
 * @param {Object} uploadData - Upload response data
 */
function addToNavigationTree(uploadData) {
    const { navigation, html_path, html_filename } = uploadData;

    console.log('Adding to tree:', navigation);
    console.log('HTML path:', html_path);

    // Get or create tree section for the root category
    const rootCategory = navigation[0];
    const treeSection = getOrCreateTreeSection(rootCategory);
    const structure = treeSection.structure;
    const treeContainer = treeSection.container;

    // Navigate through the navigation path and create nested structure
    let currentLevel = structure;

    for (let i = 1; i < navigation.length; i++) {
        const title = navigation[i];

        // Find existing item at current level
        let existingItem = currentLevel.find(item => item.title === title);

        if (i === navigation.length - 1) {
            // This is the actual document (leaf node)
            if (!existingItem) {
                const newDoc = {
                    title: title,
                    file: html_path
                };
                currentLevel.push(newDoc);
                console.log('Added document:', title, 'at level', i);
            } else {
                console.log('Document already exists:', title);
            }
        } else {
            // This is a category/folder
            if (!existingItem) {
                existingItem = {
                    title: title,
                    children: []
                };
                currentLevel.push(existingItem);
                console.log('Created category:', title, 'at level', i);
            } else {
                // Make sure children array exists
                if (!existingItem.children) {
                    existingItem.children = [];
                }
                console.log('Found existing category:', title, 'at level', i);
            }
            currentLevel = existingItem.children;
        }
    }

    // Regenerate the tree
    console.log('Regenerating tree...');
    treeContainer.innerHTML = '';
    generateTree(structure, treeContainer);

    // Expand to show the new item
    expandPathInTree(navigation, treeContainer);

    console.log('Successfully added to navigation tree:', navigation.join(' > '));
}

/**
 * Expand path in tree to show newly added item
 * @param {Array} navigation - Navigation path array
 * @param {HTMLElement} treeContainer - Tree container element
 */
function expandPathInTree(navigation, treeContainer) {
    // Find and expand all parent folders to make the new item visible
    let currentElement = treeContainer;

    for (let i = 1; i < navigation.length - 1; i++) {
        const title = navigation[i];
        const items = currentElement.querySelectorAll('.tree-item');

        for (let item of items) {
            const label = item.querySelector('.tree-label span:last-child');
            if (label && label.textContent === title) {
                // Found the folder, expand it
                const children = item.querySelector('.tree-children');

                if (children) {
                    // Use CSS classes instead of manual text setting
                    item.classList.add('expanded');
                    children.classList.add('expanded');
                    currentElement = children;
                }
                break;
            }
        }
    }

    // Highlight the new document
    const allItems = treeContainer.querySelectorAll('.tree-item');
    const docTitle = navigation[navigation.length - 1];

    for (let item of allItems) {
        const label = item.querySelector('.tree-label span:last-child');
        if (label && label.textContent === docTitle) {
            label.style.backgroundColor = '#fffacd';
            setTimeout(() => {
                label.style.backgroundColor = '';
            }, 3000);

            // Scroll into view
            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
            break;
        }
    }
}

// =============================================================================
// Initialization and Event Listeners
// =============================================================================

/**
 * Initialize the application
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Load uploaded documents first
    await loadUploadedDocuments();

    // Setup search input listener
    const searchBox = document.getElementById('searchBox');
    searchBox.addEventListener('input', (e) => {
        handleSearch(e.target.value);
    });

    // Build content index in background
    buildContentIndex().catch(error => {
        console.error('Failed to build content index:', error);
        document.getElementById('indexingStatus').textContent = 'Indexing failed';
    });

    // Setup drag and drop handlers
    const uploadArea = document.getElementById('uploadArea');

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
            handleFile(files[0]);
        }
    });

    // Close modal when clicking outside
    document.addEventListener('click', (event) => {
        const modal = document.getElementById('uploadModal');
        if (event.target === modal) {
            closeUploadModal();
        }
    });
});
