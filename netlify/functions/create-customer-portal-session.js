/* ============================================
   CREATE CUSTOMER PORTAL SESSION
   Creates a Stripe Customer Portal session for subscription management
   ============================================ */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
        const body = event.body ? JSON.parse(event.body) : {};
        const { customer_id } = body;

        if (!customer_id) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Missing customer_id' })
            };
        }

        // Get the site URL for redirect
        const siteUrl = process.env.URL || 'http://localhost:8888';

        // Create portal session
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: customer_id,
            return_url: `${siteUrl}/portal/index.html`
        });

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: portalSession.url })
        };

    } catch (error) {
        console.error('Customer portal error:', error);

        if (error.type === 'StripeInvalidRequestError') {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Invalid customer ID' })
            };
        }

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Failed to create portal session' })
        };
    }
};
