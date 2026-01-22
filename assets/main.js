/* ============================================
   THE MODERN STUDENT - MAIN JS
   Shared functionality for public pages
   ============================================ */

// ============================================
// CONSTANTS
// ============================================
const STORAGE_KEYS = {
    COUNTER: 'tms_student_counter',
    COUNTER_TIMESTAMP: 'tms_counter_timestamp',
    ACCESS: 'tms_access_granted',
    ACCESS_TIER: 'tms_access_tier'
};

const VALID_CODES = {
    standard: ['STUDENT2025', 'MODERN2025'],
    premium: ['PREMIUM2025', 'PROPREMIUM']
};

const COUNTER_SEED = 1247;
const COUNTER_INCREMENT_MS = 2 * 60 * 1000; // 2 minutes

// ============================================
// UTILITIES
// ============================================
function $(selector, context = document) {
    return context.querySelector(selector);
}

function $$(selector, context = document) {
    return [...context.querySelectorAll(selector)];
}

function formatNumber(num) {
    return num.toLocaleString();
}

function debounce(fn, ms) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), ms);
    };
}

// ============================================
// NAVBAR
// ============================================
function initNavbar() {
    const navbar = $('.navbar');
    if (!navbar) return;

    // Scroll effect
    const handleScroll = () => {
        if (window.scrollY > 20) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
}

// ============================================
// MOBILE MENU
// ============================================
function initMobileMenu() {
    const hamburger = $('.hamburger');
    const mobileMenu = $('.mobile-menu');
    if (!hamburger || !mobileMenu) return;

    hamburger.addEventListener('click', () => {
        const isActive = hamburger.classList.toggle('active');
        mobileMenu.classList.toggle('active');
        hamburger.setAttribute('aria-expanded', isActive);
        document.body.style.overflow = isActive ? 'hidden' : '';
    });

    // Close on link click
    $$('a', mobileMenu).forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            mobileMenu.classList.remove('active');
            hamburger.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        });
    });
}

// ============================================
// STUDENT COUNTER
// ============================================
function initCounter() {
    const counterEl = $('#counterValue');
    if (!counterEl) return;

    let count = parseInt(localStorage.getItem(STORAGE_KEYS.COUNTER)) || COUNTER_SEED;
    let lastUpdate = parseInt(localStorage.getItem(STORAGE_KEYS.COUNTER_TIMESTAMP)) || Date.now();

    // Calculate increments since last visit
    const elapsed = Date.now() - lastUpdate;
    const increments = Math.floor(elapsed / COUNTER_INCREMENT_MS);
    count += increments;

    updateCounterDisplay(count);
    saveCounter(count);

    // Live updates
    setInterval(() => {
        count++;
        updateCounterDisplay(count, true);
        saveCounter(count);
    }, COUNTER_INCREMENT_MS);
}

function updateCounterDisplay(count, animate = false) {
    const counterEl = $('#counterValue');
    if (!counterEl) return;

    if (animate) {
        counterEl.style.transform = 'scale(1.1)';
        setTimeout(() => {
            counterEl.style.transform = 'scale(1)';
        }, 150);
    }

    counterEl.textContent = formatNumber(count);
}

function saveCounter(count) {
    localStorage.setItem(STORAGE_KEYS.COUNTER, count);
    localStorage.setItem(STORAGE_KEYS.COUNTER_TIMESTAMP, Date.now());
}

// ============================================
// ACCORDIONS
// ============================================
function initAccordions() {
    $$('.accordion').forEach(accordion => {
        const header = $('.accordion-header', accordion);
        if (!header) return;

        header.addEventListener('click', () => toggleAccordion(accordion));
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleAccordion(accordion);
            }
        });
    });
}

function toggleAccordion(accordion) {
    const isExpanded = accordion.getAttribute('aria-expanded') === 'true';
    accordion.setAttribute('aria-expanded', !isExpanded);
}

// ============================================
// ACCESS CODE MODAL
// ============================================
let modalLastFocus = null;

function initAccessModal() {
    const modal = $('#accessModal');
    if (!modal) return;

    const form = $('#accessForm', modal);
    const codeInput = $('#accessCode', modal);
    const errorEl = $('#accessError', modal);
    const closeBtn = $('.modal-close', modal);
    const tierEl = $('#modalTier', modal);

    // Close button
    if (closeBtn) {
        closeBtn.addEventListener('click', closeAccessModal);
    }

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAccessModal();
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeAccessModal();
        }
    });

    // Form submission
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const code = codeInput.value.trim().toUpperCase();

            let tier = null;
            if (VALID_CODES.premium.includes(code)) {
                tier = 'premium';
            } else if (VALID_CODES.standard.includes(code)) {
                tier = 'standard';
            }

            if (tier) {
                grantAccess(tier);
                window.location.href = 'portal/index.html';
            } else {
                showAccessError(codeInput, errorEl);
            }
        });

        // Clear error on input
        codeInput.addEventListener('input', () => {
            errorEl.classList.remove('show');
            codeInput.classList.remove('error');
        });
    }

    // Focus trap
    modal.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const focusable = $$('button, input, a[href]', modal).filter(el =>
            el.offsetParent !== null
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    });
}

function openAccessModal(tier = 'standard') {
    const modal = $('#accessModal');
    if (!modal) return;

    modalLastFocus = document.activeElement;

    const tierEl = $('#modalTier', modal);
    if (tierEl) tierEl.textContent = tier.toUpperCase();

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    const codeInput = $('#accessCode', modal);
    if (codeInput) {
        codeInput.value = '';
        setTimeout(() => codeInput.focus(), 100);
    }
}

function closeAccessModal() {
    const modal = $('#accessModal');
    if (!modal) return;

    modal.classList.remove('active');
    document.body.style.overflow = '';

    if (modalLastFocus) {
        modalLastFocus.focus();
    }
}

function showAccessError(input, errorEl) {
    input.classList.add('error');
    errorEl.classList.add('show');

    input.style.animation = 'none';
    input.offsetHeight; // Trigger reflow
    input.style.animation = 'shake 0.4s ease-in-out';

    setTimeout(() => {
        input.classList.remove('error');
    }, 400);
}

function grantAccess(tier) {
    localStorage.setItem(STORAGE_KEYS.ACCESS, 'true');
    localStorage.setItem(STORAGE_KEYS.ACCESS_TIER, tier);
}

function checkAccess() {
    return localStorage.getItem(STORAGE_KEYS.ACCESS) === 'true';
}

function getAccessTier() {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TIER) || 'standard';
}

function revokeAccess() {
    localStorage.removeItem(STORAGE_KEYS.ACCESS);
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TIER);
}

// Make modal function globally available
window.openAccessModal = openAccessModal;
window.closeAccessModal = closeAccessModal;

// ============================================
// SMOOTH SCROLL
// ============================================
function initSmoothScroll() {
    $$('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;

            e.preventDefault();
            const target = $(href);
            if (target) {
                const offset = 72;
                const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });
}

// ============================================
// FLOATING CTA
// ============================================
function initFloatingCta() {
    const floatingCta = $('#floatingCta');
    if (!floatingCta) return;

    const hero = $('.hero');
    const footer = $('.footer');

    const handleScroll = () => {
        const scrollY = window.scrollY;
        const heroHeight = hero ? hero.offsetHeight : 600;
        const footerTop = footer ? footer.offsetTop : document.body.scrollHeight;
        const windowHeight = window.innerHeight;

        if (scrollY > heroHeight * 0.6 && scrollY + windowHeight < footerTop - 100) {
            floatingCta.classList.add('visible');
        } else {
            floatingCta.classList.remove('visible');
        }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
}

// ============================================
// CONTACT FORM
// ============================================
function initContactForm() {
    const form = $('#contactForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        // Show success state
        const successEl = $('#formSuccess');
        if (successEl) {
            form.style.display = 'none';
            successEl.style.display = 'block';
        } else {
            showToast('Message sent! We\'ll be in touch within 24 hours.', 'success');
            form.reset();
        }
    });
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'success') {
    let container = $('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor">
            ${type === 'success'
                ? '<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>'
                : '<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>'
            }
        </svg>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Remove after delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 200);
    }, 3000);
}

// Make toast globally available
window.showToast = showToast;

// ============================================
// TABS
// ============================================
function initTabs() {
    $$('[data-tabs]').forEach(tabContainer => {
        const tabs = $$('.tab', tabContainer);
        const panels = $$('[data-tab-panel]');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;

                // Update tabs
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Update panels
                panels.forEach(panel => {
                    if (panel.dataset.tabPanel === target) {
                        panel.style.display = 'block';
                    } else {
                        panel.style.display = 'none';
                    }
                });
            });
        });
    });
}

// ============================================
// COPY TO CLIPBOARD
// ============================================
async function copyToClipboard(text, btn) {
    try {
        await navigator.clipboard.writeText(text);

        // Update button state
        const originalText = btn.innerHTML;
        btn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
            Copied!
        `;
        btn.classList.add('btn-success');

        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.remove('btn-success');
        }, 2000);

        showToast('Copied to clipboard!', 'success');
    } catch (err) {
        showToast('Failed to copy', 'error');
    }
}

// Make copy function globally available
window.copyToClipboard = copyToClipboard;

// ============================================
// ACTIVE NAV LINK
// ============================================
function setActiveNavLink() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';

    $$('.navbar-links a, .sidebar-link').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath || (currentPath === '' && href === 'index.html')) {
            link.classList.add('active');
        }
    });
}

// ============================================
// INITIALIZATION
// ============================================
function init() {
    initNavbar();
    initMobileMenu();
    initCounter();
    initAccordions();
    initAccessModal();
    initSmoothScroll();
    initFloatingCta();
    initContactForm();
    initTabs();
    setActiveNavLink();
}

// Run on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ============================================
// EXPORTS FOR PORTAL
// ============================================
window.TMS = {
    checkAccess,
    getAccessTier,
    revokeAccess,
    showToast,
    copyToClipboard,
    STORAGE_KEYS
};
