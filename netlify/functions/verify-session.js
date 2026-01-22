/* ============================================
   VERIFY SESSION
   Verifies a Stripe Checkout session and returns access token
   ============================================ */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
    // Only allow GET
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const sessionId = event.queryStringParameters?.session_id;

        if (!sessionId) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Missing session_id parameter' })
            };
        }

        // Retrieve the checkout session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['subscription', 'line_items']
        });

        // Check if payment was successful
        if (session.payment_status !== 'paid') {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Payment not completed' })
            };
        }

        // Determine access level based on the plan
        const plan = session.metadata?.plan;
        let courseAccess = false;
        let memberAccess = false;
        let expiresAt = null;

        if (plan === 'membership' || session.mode === 'subscription') {
            // Membership: full access while subscription is active
            courseAccess = true;
            memberAccess = true;

            // Set expiry based on subscription period end
            if (session.subscription) {
                const subscription = typeof session.subscription === 'string'
                    ? await stripe.subscriptions.retrieve(session.subscription)
                    : session.subscription;

                // Add buffer time (7 days) to handle renewal grace period
                expiresAt = (subscription.current_period_end * 1000) + (7 * 24 * 60 * 60 * 1000);
            } else {
                // Fallback: 35 days from now
                expiresAt = Date.now() + (35 * 24 * 60 * 60 * 1000);
            }
        } else if (plan === 'course' || session.mode === 'payment') {
            // Course: lifetime access
            courseAccess = true;
            memberAccess = false;
            // No expiry for lifetime course access (set far future date)
            expiresAt = Date.now() + (100 * 365 * 24 * 60 * 60 * 1000); // 100 years
        }

        // Get customer email for account creation
        const customerEmail = session.customer_email || session.customer_details?.email;

        // Return access token data
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                course_access: courseAccess,
                member_access: memberAccess,
                expires_at: expiresAt,
                customer_id: session.customer,
                customer_email: customerEmail,
                plan: plan
            })
        };

    } catch (error) {
        console.error('Session verification error:', error);

        // Handle specific Stripe errors
        if (error.type === 'StripeInvalidRequestError') {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Invalid session ID' })
            };
        }

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Failed to verify session' })
        };
    }
};
