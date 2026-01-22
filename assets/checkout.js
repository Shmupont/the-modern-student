/* ============================================
   THE MODERN STUDENT - CHECKOUT JS
   Stripe Checkout integration
   ============================================ */

// ============================================
// CONFIGURATION
// ============================================
// API endpoint - update this for production
const API_BASE = '/api';

// ============================================
// TOKEN MANAGEMENT
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

function setAccessToken(token) {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
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

// ============================================
// CHECKOUT FLOW
// ============================================
async function buyPlan(plan) {
    const btn = document.getElementById(plan === 'course' ? 'buyCourseBtn' : 'buyMembershipBtn');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Loading...';
    }

    // Check if user is logged in - require account before purchase
    if (window.TMS_Auth) {
        const session = await TMS_Auth.getSession();
        if (!session) {
            // Not logged in - redirect to signup with plan info
            window.location.href = `signup.html?plan=${plan}&redirect=pricing`;
            return;
        }
    }

    try {
        // Get user email to pre-fill Stripe checkout
        let customerEmail = null;
        if (window.TMS_Auth) {
            const user = await TMS_Auth.getUser();
            customerEmail = user?.email;
        }

        const response = await fetch(`${API_BASE}/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                plan,
                customer_email: customerEmail
            })
        });

        if (!response.ok) {
            throw new Error('Failed to create checkout session');
        }

        const data = await response.json();

        if (data.url) {
            // Redirect to Stripe Checkout
            window.location.href = data.url;
        } else {
            throw new Error('No checkout URL returned');
        }
    } catch (error) {
        console.error('Checkout error:', error);
        showToast('Something went wrong. Please try again.', 'error');

        if (btn) {
            btn.disabled = false;
            btn.innerHTML = plan === 'course'
                ? 'Buy Course — $20'
                : 'Join Membership — $5.99/mo';
        }
    }
}

// ============================================
// CUSTOMER PORTAL (For Members)
// ============================================
async function openCustomerPortal() {
    const token = getAccessToken();
    if (!token?.customer_id) {
        showToast('Unable to find customer information. Please contact support.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/create-customer-portal-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ customer_id: token.customer_id })
        });

        if (!response.ok) {
            throw new Error('Failed to create portal session');
        }

        const data = await response.json();

        if (data.url) {
            window.location.href = data.url;
        }
    } catch (error) {
        console.error('Portal error:', error);
        showToast('Unable to open billing portal. Please try again.', 'error');
    }
}

// ============================================
// LOGOUT
// ============================================
function logout() {
    if (confirm('Are you sure you want to log out?')) {
        clearAccessToken();
        // Also clear legacy access keys for backwards compatibility
        localStorage.removeItem('tms_access_granted');
        localStorage.removeItem('tms_access_tier');
        window.location.href = '/index.html';
    }
}

// ============================================
// UI UPDATES
// ============================================
function updateNavForAccess() {
    const navBtn = document.getElementById('navAccessBtn');
    if (!navBtn) return;

    if (hasValidAccess()) {
        navBtn.textContent = 'Go to Portal';
        navBtn.href = 'portal/index.html';
    }
}

function updatePricingPageForAccess() {
    const courseBtn = document.getElementById('buyCourseBtn');
    const memberBtn = document.getElementById('buyMembershipBtn');

    if (hasCourseAccess() && courseBtn) {
        courseBtn.textContent = '✓ Course Owned';
        courseBtn.disabled = true;
        courseBtn.classList.add('btn-success');
    }

    if (hasMemberAccess() && memberBtn) {
        memberBtn.textContent = 'Manage Membership';
        memberBtn.onclick = openCustomerPortal;
    }
}

// ============================================
// TOAST (if not already available)
// ============================================
function showToast(message, type = 'success') {
    if (window.showToast) {
        window.showToast(message, type);
        return;
    }

    // Fallback toast implementation
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 200);
    }, 3000);
}

// ============================================
// INITIALIZATION
// ============================================
function initCheckout() {
    updateNavForAccess();

    // Only run on pricing page
    if (window.location.pathname.includes('pricing')) {
        updatePricingPageForAccess();
    }
}

// Make functions globally available
window.buyPlan = buyPlan;
window.openCustomerPortal = openCustomerPortal;
window.logout = logout;
window.hasValidAccess = hasValidAccess;
window.hasCourseAccess = hasCourseAccess;
window.hasMemberAccess = hasMemberAccess;
window.getAccessToken = getAccessToken;
window.setAccessToken = setAccessToken;
window.clearAccessToken = clearAccessToken;

// Run on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCheckout);
} else {
    initCheckout();
}
