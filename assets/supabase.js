/* ============================================
   THE MODERN STUDENT - SUPABASE AUTH & SYNC
   Handles authentication, entitlements, and progress tracking
   ============================================ */

// ============================================
// SUPABASE CLIENT INITIALIZATION
// ============================================
const SUPABASE_URL = 'https://your-project.supabase.co'; // Replace with your Supabase URL
const SUPABASE_ANON_KEY = 'your-anon-key'; // Replace with your Supabase anon key

// Initialize Supabase client (uses the global supabase object from CDN)
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// ============================================
// SESSION MANAGEMENT
// ============================================
async function getSession() {
    if (!supabaseClient) return null;
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) {
        console.error('Error getting session:', error);
        return null;
    }
    return session;
}

async function getUser() {
    const session = await getSession();
    return session?.user || null;
}

// ============================================
// AUTHENTICATION
// ============================================
async function signUp(email, password) {
    if (!supabaseClient) {
        return { error: { message: 'Supabase not initialized' } };
    }

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
}

async function signIn(email, password) {
    if (!supabaseClient) {
        return { error: { message: 'Supabase not initialized' } };
    }

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
    }

    return { data };
}

async function signOut() {
    if (!supabaseClient) {
        return { error: { message: 'Supabase not initialized' } };
    }

    const { error } = await supabaseClient.auth.signOut();

    if (!error) {
        // Clear any cached data
        cachedEntitlements = null;
        cachedProgress = null;

        // Clear legacy localStorage tokens
        localStorage.removeItem('tms_access_token');
        localStorage.removeItem('tms_access_granted');
        localStorage.removeItem('tms_access_tier');
    }

    return { error };
}

async function resetPassword(email) {
    if (!supabaseClient) {
        return { error: { message: 'Supabase not initialized' } };
    }

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password.html'
    });

    return { error };
}

// ============================================
// ENTITLEMENTS
// ============================================
let cachedEntitlements = null;

async function linkEntitlementsByEmail(email, userId) {
    if (!supabaseClient) return;

    // Update entitlements table to link user_id to email
    const { error } = await supabaseClient
        .from('entitlements')
        .update({ user_id: userId })
        .eq('email', email)
        .is('user_id', null);

    if (error) {
        console.error('Error linking entitlements:', error);
    }
}

async function getEntitlements() {
    if (!supabaseClient) return null;

    const user = await getUser();
    if (!user) return null;

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
    if (!supabaseClient) {
        // Fallback to localStorage
        return getLocalProgress();
    }

    const user = await getUser();
    if (!user) {
        return getLocalProgress();
    }

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
}

function getLocalProgress() {
    const stored = localStorage.getItem('tms_lesson_progress');
    return stored ? JSON.parse(stored) : {};
}

async function markLessonComplete(lessonId) {
    if (!supabaseClient) {
        return markLessonCompleteLocal(lessonId);
    }

    const user = await getUser();
    if (!user) {
        return markLessonCompleteLocal(lessonId);
    }

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
    if (!supabaseClient) {
        return markLessonIncompleteLocal(lessonId);
    }

    const user = await getUser();
    if (!user) {
        return markLessonIncompleteLocal(lessonId);
    }

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

    // Upsert to Supabase
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
}

// ============================================
// AUTH STATE LISTENER
// ============================================
function onAuthStateChange(callback) {
    if (!supabaseClient) return () => {};

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
    client: supabaseClient
};
