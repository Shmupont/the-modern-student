/* ============================================
   THE MODERN STUDENT - PORTAL JS
   Functionality for gated course portal
   ============================================ */

// ============================================
// STORAGE KEYS
// ============================================
const PORTAL_STORAGE = {
    PROGRESS: 'tms_lesson_progress',
    LAST_LESSON: 'tms_last_lesson',
    FAVORITES: 'tms_favorites',
    CHECKLIST: 'tms_weekly_checklist',
    SAVED_WORKFLOWS: 'tms_saved_workflows',
    TEMPLATE_DRAFTS: 'tms_template_drafts',
    PREFERENCES: 'tms_preferences'
};

// ============================================
// ACCESS GUARD (Token-Based)
// ============================================
const TOKEN_KEY = 'tms_access_token';

function getAccessToken() {
    const tokenData = localStorage.getItem(TOKEN_KEY);
    if (!tokenData) return null;

    try {
        const token = JSON.parse(tokenData);
        // Check if token is expired
        if (token.expires_at && Date.now() > token.expires_at) {
            clearAccessToken();
            return null;
        }
        return token;
    } catch (e) {
        clearAccessToken();
        return null;
    }
}

function clearAccessToken() {
    localStorage.removeItem(TOKEN_KEY);
}

function hasValidAccess() {
    const token = getAccessToken();
    if (!token) return false;
    return token.course_access || token.member_access;
}

function hasCourseAccess() {
    const token = getAccessToken();
    return token?.course_access === true;
}

function hasMemberAccess() {
    const token = getAccessToken();
    return token?.member_access === true;
}

function checkPortalAccess() {
    // Check new token-based access
    if (hasValidAccess()) {
        return true;
    }

    // Fallback: check legacy access (for existing users during transition)
    const legacyAccess = localStorage.getItem('tms_access_granted') === 'true';
    if (legacyAccess) {
        return true;
    }

    // No valid access - redirect to pricing
    showLockedState();
    return false;
}

function showLockedState() {
    const main = document.querySelector('.portal-main');
    if (!main) return;

    main.innerHTML = `
        <div class="locked-state">
            <div class="locked-content">
                <div class="locked-icon">🔒</div>
                <h2>Access Required</h2>
                <p>Get access to unlock the course portal and all resources.</p>
                <a href="../pricing.html" class="btn btn-primary btn-lg" style="width: 100%; margin-bottom: 16px;">
                    View Pricing
                </a>
                <p style="margin-top: 16px; color: var(--color-text-tertiary); font-size: 14px;">
                    Already purchased? <a href="../success.html" style="color: var(--color-accent-purple);">Verify your access</a>
                </p>
            </div>
        </div>
        <style>
            .locked-state {
                min-height: calc(100vh - var(--navbar-height) - 64px);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .locked-content {
                text-align: center;
                max-width: 360px;
            }
            .locked-icon {
                font-size: 4rem;
                margin-bottom: 24px;
            }
            .locked-content h2 {
                margin-bottom: 8px;
            }
            .locked-content > p {
                color: var(--color-text-secondary);
                margin-bottom: 32px;
            }
        </style>
    `;
}

// ============================================
// PROGRESS TRACKING
// ============================================
function getProgress() {
    const stored = localStorage.getItem(PORTAL_STORAGE.PROGRESS);
    return stored ? JSON.parse(stored) : {};
}

function saveProgress(progress) {
    localStorage.setItem(PORTAL_STORAGE.PROGRESS, JSON.stringify(progress));
}

function markLessonComplete(lessonId) {
    const progress = getProgress();
    progress[lessonId] = {
        completed: true,
        completedAt: Date.now()
    };
    saveProgress(progress);
    updateProgressUI();
    showToast('Lesson marked as complete!', 'success');
}

function markLessonIncomplete(lessonId) {
    const progress = getProgress();
    delete progress[lessonId];
    saveProgress(progress);
    updateProgressUI();
}

function isLessonComplete(lessonId) {
    const progress = getProgress();
    return progress[lessonId]?.completed || false;
}

function getCompletedCount() {
    const progress = getProgress();
    return Object.keys(progress).length;
}

function getProgressPercent() {
    const totalLessons = 24; // Total lessons in course
    const completed = getCompletedCount();
    return Math.round((completed / totalLessons) * 100);
}

function updateProgressUI() {
    // Update progress bars
    document.querySelectorAll('[data-progress-fill]').forEach(el => {
        el.style.width = `${getProgressPercent()}%`;
    });

    // Update progress text
    document.querySelectorAll('[data-progress-text]').forEach(el => {
        el.textContent = `${getProgressPercent()}%`;
    });

    // Update completed count
    document.querySelectorAll('[data-completed-count]').forEach(el => {
        el.textContent = getCompletedCount();
    });

    // Update lesson cards
    document.querySelectorAll('[data-lesson-id]').forEach(card => {
        const lessonId = card.dataset.lessonId;
        if (isLessonComplete(lessonId)) {
            card.classList.add('completed');
        } else {
            card.classList.remove('completed');
        }
    });
}

// ============================================
// LAST LESSON TRACKING
// ============================================
function setLastLesson(lessonId, lessonTitle) {
    localStorage.setItem(PORTAL_STORAGE.LAST_LESSON, JSON.stringify({
        id: lessonId,
        title: lessonTitle,
        timestamp: Date.now()
    }));
}

function getLastLesson() {
    const stored = localStorage.getItem(PORTAL_STORAGE.LAST_LESSON);
    return stored ? JSON.parse(stored) : null;
}

function updateContinueLearning() {
    const lastLesson = getLastLesson();
    const container = document.getElementById('continueLesson');
    if (!container || !lastLesson) return;

    container.innerHTML = `
        <a href="lesson.html?id=${lastLesson.id}" class="continue-lesson-link">
            <div class="continue-icon">▶</div>
            <div class="continue-text">
                <span class="continue-label">Continue learning</span>
                <span class="continue-title">${lastLesson.title}</span>
            </div>
        </a>
    `;
}

// ============================================
// FAVORITES
// ============================================
function getFavorites() {
    const stored = localStorage.getItem(PORTAL_STORAGE.FAVORITES);
    return stored ? JSON.parse(stored) : [];
}

function saveFavorites(favorites) {
    localStorage.setItem(PORTAL_STORAGE.FAVORITES, JSON.stringify(favorites));
}

function toggleFavorite(itemId, itemType) {
    const favorites = getFavorites();
    const key = `${itemType}:${itemId}`;
    const index = favorites.indexOf(key);

    if (index > -1) {
        favorites.splice(index, 1);
        showToast('Removed from favorites', 'success');
    } else {
        favorites.push(key);
        showToast('Added to favorites!', 'success');
    }

    saveFavorites(favorites);
    updateFavoriteButtons();
}

function isFavorite(itemId, itemType) {
    const favorites = getFavorites();
    return favorites.includes(`${itemType}:${itemId}`);
}

function updateFavoriteButtons() {
    document.querySelectorAll('[data-favorite]').forEach(btn => {
        const { itemId, itemType } = btn.dataset;
        if (isFavorite(itemId, itemType)) {
            btn.classList.add('active');
            btn.innerHTML = '★ Saved';
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '☆ Save';
        }
    });
}

// ============================================
// WEEKLY CHECKLIST
// ============================================
function getChecklist() {
    const stored = localStorage.getItem(PORTAL_STORAGE.CHECKLIST);
    if (!stored) {
        // Default checklist
        return [
            { id: '1', text: 'Complete one lesson', completed: false },
            { id: '2', text: 'Try a new AI prompt', completed: false },
            { id: '3', text: 'Practice with a real assignment', completed: false },
            { id: '4', text: 'Review prompting principles', completed: false }
        ];
    }
    return JSON.parse(stored);
}

function saveChecklist(checklist) {
    localStorage.setItem(PORTAL_STORAGE.CHECKLIST, JSON.stringify(checklist));
}

function toggleChecklistItem(id) {
    const checklist = getChecklist();
    const item = checklist.find(i => i.id === id);
    if (item) {
        item.completed = !item.completed;
        saveChecklist(checklist);
        renderChecklist();
    }
}

function renderChecklist() {
    const container = document.getElementById('weeklyChecklist');
    if (!container) return;

    const checklist = getChecklist();

    container.innerHTML = checklist.map(item => `
        <div class="checklist-item ${item.completed ? 'completed' : ''}" data-id="${item.id}">
            <div class="checklist-checkbox">
                <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
            </div>
            <span>${item.text}</span>
        </div>
    `).join('');

    // Add click handlers
    container.querySelectorAll('.checklist-item').forEach(item => {
        item.addEventListener('click', () => {
            toggleChecklistItem(item.dataset.id);
        });
    });
}

// ============================================
// SAVED WORKFLOWS
// ============================================
function getSavedWorkflows() {
    const stored = localStorage.getItem(PORTAL_STORAGE.SAVED_WORKFLOWS);
    return stored ? JSON.parse(stored) : [];
}

function saveWorkflow(workflowId) {
    const saved = getSavedWorkflows();
    if (!saved.includes(workflowId)) {
        saved.push(workflowId);
        localStorage.setItem(PORTAL_STORAGE.SAVED_WORKFLOWS, JSON.stringify(saved));
        showToast('Workflow saved!', 'success');
    }
    updateSavedWorkflowButtons();
}

function unsaveWorkflow(workflowId) {
    let saved = getSavedWorkflows();
    saved = saved.filter(id => id !== workflowId);
    localStorage.setItem(PORTAL_STORAGE.SAVED_WORKFLOWS, JSON.stringify(saved));
    showToast('Workflow removed', 'success');
    updateSavedWorkflowButtons();
}

function isWorkflowSaved(workflowId) {
    return getSavedWorkflows().includes(workflowId);
}

function updateSavedWorkflowButtons() {
    document.querySelectorAll('[data-save-workflow]').forEach(btn => {
        const workflowId = btn.dataset.saveWorkflow;
        if (isWorkflowSaved(workflowId)) {
            btn.classList.add('active');
            btn.textContent = '★ Saved';
        } else {
            btn.classList.remove('active');
            btn.textContent = '☆ Save';
        }
    });
}

// ============================================
// TEMPLATE DRAFTS
// ============================================
function getTemplateDraft(templateId) {
    const drafts = JSON.parse(localStorage.getItem(PORTAL_STORAGE.TEMPLATE_DRAFTS) || '{}');
    return drafts[templateId] || '';
}

function saveTemplateDraft(templateId, content) {
    const drafts = JSON.parse(localStorage.getItem(PORTAL_STORAGE.TEMPLATE_DRAFTS) || '{}');
    drafts[templateId] = content;
    localStorage.setItem(PORTAL_STORAGE.TEMPLATE_DRAFTS, JSON.stringify(drafts));
}

// ============================================
// PREFERENCES
// ============================================
function getPreferences() {
    const stored = localStorage.getItem(PORTAL_STORAGE.PREFERENCES);
    return stored ? JSON.parse(stored) : {
        reducedMotion: false,
        compactMode: false
    };
}

function savePreferences(prefs) {
    localStorage.setItem(PORTAL_STORAGE.PREFERENCES, JSON.stringify(prefs));
    applyPreferences();
}

function applyPreferences() {
    const prefs = getPreferences();

    if (prefs.reducedMotion) {
        document.body.classList.add('reduced-motion');
    } else {
        document.body.classList.remove('reduced-motion');
    }

    if (prefs.compactMode) {
        document.body.classList.add('compact-mode');
    } else {
        document.body.classList.remove('compact-mode');
    }
}

function initPreferenceToggles() {
    document.querySelectorAll('[data-preference]').forEach(toggle => {
        const pref = toggle.dataset.preference;
        const prefs = getPreferences();

        // Set initial state
        if (prefs[pref]) {
            toggle.classList.add('active');
        }

        toggle.addEventListener('click', () => {
            const prefs = getPreferences();
            prefs[pref] = !prefs[pref];
            savePreferences(prefs);
            toggle.classList.toggle('active');
        });
    });
}

// ============================================
// EXPORT/IMPORT PROGRESS
// ============================================
function exportProgress() {
    const data = {
        progress: getProgress(),
        favorites: getFavorites(),
        checklist: getChecklist(),
        savedWorkflows: getSavedWorkflows(),
        preferences: getPreferences(),
        exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `modern-student-progress-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Progress exported!', 'success');
}

function importProgress(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            if (data.progress) saveProgress(data.progress);
            if (data.favorites) saveFavorites(data.favorites);
            if (data.checklist) saveChecklist(data.checklist);
            if (data.savedWorkflows) localStorage.setItem(PORTAL_STORAGE.SAVED_WORKFLOWS, JSON.stringify(data.savedWorkflows));
            if (data.preferences) savePreferences(data.preferences);

            showToast('Progress imported successfully!', 'success');
            setTimeout(() => window.location.reload(), 1000);
        } catch (err) {
            showToast('Failed to import progress', 'error');
        }
    };
    reader.readAsText(file);
}

// ============================================
// SIDEBAR TOGGLE (Mobile)
// ============================================
function initSidebarToggle() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.portal-sidebar');

    if (toggle && sidebar) {
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });

        // Close on link click (mobile)
        sidebar.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 1024) {
                    sidebar.classList.remove('open');
                }
            });
        });
    }
}

// ============================================
// SEARCH & FILTER
// ============================================
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', debounce((e) => {
        const query = e.target.value.toLowerCase();
        filterItems(query);
    }, 200));
}

function filterItems(query) {
    document.querySelectorAll('[data-searchable]').forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(query)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

function initFilters() {
    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;

            // Update active state
            btn.parentElement.querySelectorAll('[data-filter]').forEach(b =>
                b.classList.remove('active')
            );
            btn.classList.add('active');

            // Filter items
            document.querySelectorAll('[data-category]').forEach(item => {
                if (filter === 'all' || item.dataset.category === filter) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });
}

// ============================================
// COPY PROMPT
// ============================================
function initCopyButtons() {
    document.querySelectorAll('[data-copy]').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.copy;
            const target = document.getElementById(targetId);
            if (target) {
                const text = target.textContent || target.value;
                copyToClipboard(text, btn);
            }
        });
    });
}

async function copyToClipboard(text, btn) {
    try {
        await navigator.clipboard.writeText(text);

        const originalHTML = btn.innerHTML;
        btn.innerHTML = '✓ Copied';

        setTimeout(() => {
            btn.innerHTML = originalHTML;
        }, 2000);

        showToast('Copied to clipboard!', 'success');
    } catch (err) {
        showToast('Failed to copy', 'error');
    }
}

// ============================================
// LOGOUT
// ============================================
function logout() {
    if (confirm('Are you sure you want to log out? Your progress is saved locally.')) {
        // Clear new token-based access
        clearAccessToken();
        // Clear legacy access keys
        localStorage.removeItem('tms_access_granted');
        localStorage.removeItem('tms_access_tier');
        window.location.href = '../index.html';
    }
}

// Make logout globally available
window.logout = logout;
window.exportProgress = exportProgress;

// ============================================
// UTILITIES
// ============================================
function debounce(fn, ms) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), ms);
    };
}

function showToast(message, type = 'success') {
    if (window.showToast) {
        window.showToast(message, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

// ============================================
// LESSON PAGE SPECIFIC
// ============================================
function initLessonPage() {
    // Get lesson ID from URL
    const params = new URLSearchParams(window.location.search);
    const lessonId = params.get('id') || '1-1';

    // Track this as last lesson
    const lessonTitle = document.querySelector('.lesson-title')?.textContent || 'Lesson';
    setLastLesson(lessonId, lessonTitle);

    // Mark complete button
    const completeBtn = document.getElementById('markCompleteBtn');
    if (completeBtn) {
        if (isLessonComplete(lessonId)) {
            completeBtn.textContent = '✓ Completed';
            completeBtn.classList.add('btn-success');
        }

        completeBtn.addEventListener('click', () => {
            if (isLessonComplete(lessonId)) {
                markLessonIncomplete(lessonId);
                completeBtn.textContent = 'Mark Complete';
                completeBtn.classList.remove('btn-success');
            } else {
                markLessonComplete(lessonId);
                completeBtn.textContent = '✓ Completed';
                completeBtn.classList.add('btn-success');
            }
        });
    }
}

// ============================================
// INITIALIZATION
// ============================================
function initPortal() {
    // Check access first
    if (!checkPortalAccess()) return;

    // Apply preferences
    applyPreferences();

    // Initialize components
    initSidebarToggle();
    initSearch();
    initFilters();
    initCopyButtons();
    initPreferenceToggles();

    // Update UI
    updateProgressUI();
    updateContinueLearning();
    renderChecklist();
    updateFavoriteButtons();
    updateSavedWorkflowButtons();

    // Page-specific init
    if (window.location.pathname.includes('lesson.html')) {
        initLessonPage();
    }

    // Set active nav
    setActivePortalNav();
}

function setActivePortalNav() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';

    document.querySelectorAll('.sidebar-link').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath) {
            link.classList.add('active');
        }
    });
}

// Run on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPortal);
} else {
    initPortal();
}

// ============================================
// EXPORTS
// ============================================
window.Portal = {
    markLessonComplete,
    markLessonIncomplete,
    isLessonComplete,
    toggleFavorite,
    saveWorkflow,
    unsaveWorkflow,
    exportProgress,
    importProgress,
    logout
};
