/* ============================================
   CREATE CHECKOUT SESSION
   Creates a Stripe Checkout session for course or membership purchase
   ============================================ */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Price IDs - set these in your Netlify environment variables
const COURSE_PRICE_ID = process.env.PRICE_ID_PRODUCT_ONLY;
const MEMBERSHIP_PRICE_ID = process.env.STRIPE_COURSE_MEMBERHSIP_PRICE_ID;

exports.handler = async (event) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { plan } = JSON.parse(event.body);

        if (!plan || !['course', 'membership'].includes(plan)) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Invalid plan. Must be "course" or "membership".' })
            };
        }

        // Get the site URL for redirects
        const siteUrl = process.env.URL || 'http://localhost:8888';

        let sessionConfig;

        if (plan === 'course') {
            // One-time payment for course
            sessionConfig = {
                mode: 'payment',
                line_items: [{
                    price: COURSE_PRICE_ID,
                    quantity: 1
                }],
                success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${siteUrl}/pricing.html`,
                metadata: {
                    plan: 'course'
                }
            };
        } else {
            // Subscription for membership
            sessionConfig = {
                mode: 'subscription',
                line_items: [{
                    price: MEMBERSHIP_PRICE_ID,
                    quantity: 1
                }],
                success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${siteUrl}/pricing.html`,
                metadata: {
                    plan: 'membership'
                }
            };
        }

        const session = await stripe.checkout.sessions.create(sessionConfig);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: session.url })
        };

    } catch (error) {
        console.error('Checkout session error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Failed to create checkout session' })
        };
    }
};
