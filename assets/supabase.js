/* ============================================
   THE MODERN STUDENT - SUPABASE AUTH & SYNC
   Handles authentication, entitlements, and progress tracking
   ============================================ */

// ============================================
// SUPABASE CLIENT INITIALIZATION
// ============================================
const SUPABASE_URL = 'https://quadnjgbysjloucnimaa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DeKnIKQ4UnfV-vVrQNV3Dg_8bBpErF7';

// Wait for Supabase CDN to load with retry
let supabaseClient = null;
let supabaseInitPromise = null;

function initSupabase() {
    if (supabaseInitPromise) return supabaseInitPromise;

    supabaseInitPromise = new Promise((resolve) => {
        // Check if already available
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            resolve(supabaseClient);
            return;
        }

        // Wait for it with timeout
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max

        const checkInterval = setInterval(() => {
            attempts++;
            if (window.supabase) {
                clearInterval(checkInterval);
                supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                resolve(supabaseClient);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.error('Supabase CDN failed to load after 5 seconds');
                resolve(null);
            }
        }, 100);
    });

    return supabaseInitPromise;
}

// Initialize immediately
initSupabase();

// ============================================
// AUTH STATE MANAGEMENT
// ============================================
const AuthState = {
    LOADING: 'loading',
    AUTHENTICATED: 'authenticated',
    UNAUTHENTICATED: 'unauthenticated',
    ERROR: 'error'
};

let currentAuthState = AuthState.LOADING;
let authStateListeners = [];

function getAuthState() {
    return currentAuthState;
}

function setAuthState(state) {
    currentAuthState = state;
    authStateListeners.forEach(listener => listener(state));
}

function onAuthStateUpdate(callback) {
    authStateListeners.push(callback);
    // Call immediately with current state
    callback(currentAuthState);
    return () => {
        authStateListeners = authStateListeners.filter(l => l !== callback);
    };
}

// ============================================
// SESSION MANAGEMENT
// ============================================
async function getSession() {
    await initSupabase();
    if (!supabaseClient) {
        setAuthState(AuthState.ERROR);
        return null;
    }

    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) {
            console.error('Error getting session:', error);
            setAuthState(AuthState.ERROR);
            return null;
        }

        if (session) {
            setAuthState(AuthState.AUTHENTICATED);
        } else {
            setAuthState(AuthState.UNAUTHENTICATED);
        }

        return session;
    } catch (err) {
        console.error('Session fetch failed:', err);
        setAuthState(AuthState.ERROR);
        return null;
    }
}

async function getUser() {
    const session = await getSession();
    return session?.user || null;
}

// ============================================
// AUTHENTICATION
// ============================================
async function signUp(email, password) {
    await initSupabase();
    if (!supabaseClient) {
        return { error: { message: 'Authentication service unavailable. Please refresh the page.' } };
    }

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password
        });

        if (error) {
            return { error };
        }

        // After signup, try to link any existing entitlements by email
        if (data.user) {
            await linkEntitlementsByEmail(data.user.email, data.user.id);
        }

        return { data };
    } catch (err) {
        return { error: { message: 'Signup failed. Please try again.' } };
    }
}

async function signIn(email, password) {
    await initSupabase();
    if (!supabaseClient) {
        return { error: { message: 'Authentication service unavailable. Please refresh the page.' } };
    }

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            return { error };
        }

        // After login, link entitlements and migrate localStorage progress
        if (data.user) {
            await linkEntitlementsByEmail(data.user.email, data.user.id);
            await migrateLocalProgress(data.user.id);
            setAuthState(AuthState.AUTHENTICATED);
        }

        return { data };
    } catch (err) {
        return { error: { message: 'Sign in failed. Please try again.' } };
    }
}

async function signOut() {
    await initSupabase();
    if (!supabaseClient) {
        return { error: { message: 'Authentication service unavailable.' } };
    }

    try {
        const { error } = await supabaseClient.auth.signOut();

        if (!error) {
            // Clear any cached data
            cachedEntitlements = null;
            cachedProgress = null;
            setAuthState(AuthState.UNAUTHENTICATED);

            // Clear legacy localStorage tokens
            localStorage.removeItem('tms_access_token');
            localStorage.removeItem('tms_access_granted');
            localStorage.removeItem('tms_access_tier');
        }

        return { error };
    } catch (err) {
        return { error: { message: 'Sign out failed.' } };
    }
}

async function resetPassword(email) {
    await initSupabase();
    if (!supabaseClient) {
        return { error: { message: 'Authentication service unavailable.' } };
    }

    try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password.html'
        });
        return { error };
    } catch (err) {
        return { error: { message: 'Password reset failed.' } };
    }
}

// ============================================
// ENTITLEMENTS
// ============================================
let cachedEntitlements = null;

async function linkEntitlementsByEmail(email, userId) {
    await initSupabase();
    if (!supabaseClient) return;

    try {
        const { error } = await supabaseClient
            .from('entitlements')
            .update({ user_id: userId })
            .eq('email', email)
            .is('user_id', null);

        if (error) {
            console.error('Error linking entitlements:', error);
        }
    } catch (err) {
        console.error('Link entitlements failed:', err);
    }
}

async function getEntitlements() {
    await initSupabase();
    if (!supabaseClient) return null;

    const user = await getUser();
    if (!user) return null;

    try {
        // Try to fetch by user_id first, then by email
        let { data, error } = await supabaseClient
            .from('entitlements')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

        if (!data && !error) {
            // Fallback to email lookup
            const result = await supabaseClient
                .from('entitlements')
                .select('*')
                .eq('email', user.email)
                .maybeSingle();
            data = result.data;
            error = result.error;
        }

        if (error) {
            console.error('Error fetching entitlements:', error);
            return null;
        }

        cachedEntitlements = data;
        return data;
    } catch (err) {
        console.error('Entitlements fetch failed:', err);
        return null;
    }
}

async function hasValidAccess() {
    const entitlements = cachedEntitlements || await getEntitlements();
    if (!entitlements) return false;
    return entitlements.course_access || entitlements.member_access;
}

async function hasCourseAccess() {
    const entitlements = cachedEntitlements || await getEntitlements();
    return entitlements?.course_access === true;
}

async function hasMemberAccess() {
    const entitlements = cachedEntitlements || await getEntitlements();
    if (!entitlements) return false;
    return entitlements.member_access === true &&
           entitlements.membership_status === 'active';
}

// ============================================
// PROGRESS TRACKING
// ============================================
let cachedProgress = null;

async function getProgress() {
    await initSupabase();
    if (!supabaseClient) {
        return getLocalProgress();
    }

    const user = await getUser();
    if (!user) {
        return getLocalProgress();
    }

    try {
        const { data, error } = await supabaseClient
            .from('progress')
            .select('lesson_id, completed, completed_at')
            .eq('user_id', user.id);

        if (error) {
            console.error('Error fetching progress:', error);
            return getLocalProgress();
        }

        // Convert array to object format matching existing localStorage format
        const progressObj = {};
        data.forEach(item => {
            progressObj[item.lesson_id] = {
                completed: item.completed,
                completedAt: new Date(item.completed_at).getTime()
            };
        });

        cachedProgress = progressObj;
        return progressObj;
    } catch (err) {
        console.error('Progress fetch failed:', err);
        return getLocalProgress();
    }
}

function getLocalProgress() {
    const stored = localStorage.getItem('tms_lesson_progress');
    return stored ? JSON.parse(stored) : {};
}

async function markLessonComplete(lessonId) {
    await initSupabase();
    if (!supabaseClient) {
        return markLessonCompleteLocal(lessonId);
    }

    const user = await getUser();
    if (!user) {
        return markLessonCompleteLocal(lessonId);
    }

    try {
        const { error } = await supabaseClient
            .from('progress')
            .upsert({
                user_id: user.id,
                lesson_id: lessonId,
                completed: true,
                completed_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,lesson_id'
            });

        if (error) {
            console.error('Error marking lesson complete:', error);
            return false;
        }

        // Update cache
        if (!cachedProgress) cachedProgress = {};
        cachedProgress[lessonId] = {
            completed: true,
            completedAt: Date.now()
        };

        return true;
    } catch (err) {
        console.error('Mark complete failed:', err);
        return false;
    }
}

function markLessonCompleteLocal(lessonId) {
    const progress = getLocalProgress();
    progress[lessonId] = {
        completed: true,
        completedAt: Date.now()
    };
    localStorage.setItem('tms_lesson_progress', JSON.stringify(progress));
    return true;
}

async function markLessonIncomplete(lessonId) {
    await initSupabase();
    if (!supabaseClient) {
        return markLessonIncompleteLocal(lessonId);
    }

    const user = await getUser();
    if (!user) {
        return markLessonIncompleteLocal(lessonId);
    }

    try {
        const { error } = await supabaseClient
            .from('progress')
            .delete()
            .eq('user_id', user.id)
            .eq('lesson_id', lessonId);

        if (error) {
            console.error('Error marking lesson incomplete:', error);
            return false;
        }

        // Update cache
        if (cachedProgress) {
            delete cachedProgress[lessonId];
        }

        return true;
    } catch (err) {
        console.error('Mark incomplete failed:', err);
        return false;
    }
}

function markLessonIncompleteLocal(lessonId) {
    const progress = getLocalProgress();
    delete progress[lessonId];
    localStorage.setItem('tms_lesson_progress', JSON.stringify(progress));
    return true;
}

async function isLessonComplete(lessonId) {
    const progress = cachedProgress || await getProgress();
    return progress[lessonId]?.completed || false;
}

// ============================================
// LOCALSTORAGE MIGRATION
// ============================================
async function migrateLocalProgress(userId) {
    await initSupabase();
    if (!supabaseClient) return;

    // Get localStorage progress
    const localProgress = getLocalProgress();
    const lessonIds = Object.keys(localProgress);

    if (lessonIds.length === 0) return;

    // Also check for legacy tms_completed_lessons format
    const legacyCompleted = JSON.parse(localStorage.getItem('tms_completed_lessons') || '[]');

    // Merge both sources
    const allLessons = new Set([...lessonIds, ...legacyCompleted]);

    if (allLessons.size === 0) return;

    // Prepare upsert data
    const progressRecords = [];
    allLessons.forEach(lessonId => {
        const existing = localProgress[lessonId];
        progressRecords.push({
            user_id: userId,
            lesson_id: lessonId,
            completed: true,
            completed_at: existing?.completedAt
                ? new Date(existing.completedAt).toISOString()
                : new Date().toISOString()
        });
    });

    try {
        const { error } = await supabaseClient
            .from('progress')
            .upsert(progressRecords, {
                onConflict: 'user_id,lesson_id',
                ignoreDuplicates: true
            });

        if (error) {
            console.error('Error migrating progress:', error);
            return;
        }

        // Clear localStorage progress after successful migration
        localStorage.removeItem('tms_lesson_progress');
        localStorage.removeItem('tms_completed_lessons');

        console.log('Progress migrated successfully');
    } catch (err) {
        console.error('Migration failed:', err);
    }
}

// ============================================
// AUTH STATE LISTENER
// ============================================
function onAuthStateChange(callback) {
    if (!supabaseClient) {
        initSupabase().then(() => {
            if (supabaseClient) {
                const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
                    (event, session) => {
                        callback(event, session);
                    }
                );
                return () => subscription?.unsubscribe();
            }
        });
        return () => {};
    }

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
        (event, session) => {
            callback(event, session);
        }
    );

    return () => subscription?.unsubscribe();
}

// ============================================
// EXPORTS
// ============================================
window.TMS_Auth = {
    // Auth State
    AuthState,
    getAuthState,
    onAuthStateUpdate,

    // Session
    getSession,
    getUser,

    // Auth
    signUp,
    signIn,
    signOut,
    resetPassword,
    onAuthStateChange,

    // Entitlements
    getEntitlements,
    hasValidAccess,
    hasCourseAccess,
    hasMemberAccess,

    // Progress
    getProgress,
    markLessonComplete,
    markLessonIncomplete,
    isLessonComplete,

    // Migration
    migrateLocalProgress,

    // Supabase client (for advanced usage)
    get client() { return supabaseClient; },

    // Initialize (can be called to ensure ready)
    init: initSupabase
};
