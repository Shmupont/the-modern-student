/**
 * Stripe Webhook Handler
 * Manages entitlements based on Stripe events
 *
 * Events handled:
 * - checkout.session.completed → Create/update entitlement
 * - customer.subscription.updated → Update membership status
 * - customer.subscription.deleted → Revoke member access
 * - invoice.payment_failed → Set membership to past_due
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase with service role key for admin access
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const sig = event.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let stripeEvent;

    try {
        stripeEvent = stripe.webhooks.constructEvent(
            event.body,
            sig,
            webhookSecret
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: `Webhook Error: ${err.message}` })
        };
    }

    console.log('Received Stripe event:', stripeEvent.type);

    try {
        switch (stripeEvent.type) {
            case 'checkout.session.completed':
                await handleCheckoutComplete(stripeEvent.data.object);
                break;

            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(stripeEvent.data.object);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(stripeEvent.data.object);
                break;

            case 'invoice.payment_failed':
                await handlePaymentFailed(stripeEvent.data.object);
                break;

            default:
                console.log(`Unhandled event type: ${stripeEvent.type}`);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ received: true })
        };
    } catch (err) {
        console.error('Error processing webhook:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Webhook processing failed' })
        };
    }
};

/**
 * Handle successful checkout - create/update entitlement
 */
async function handleCheckoutComplete(session) {
    const email = session.customer_email || session.customer_details?.email;
    const customerId = session.customer;
    const mode = session.mode; // 'payment' for one-time, 'subscription' for recurring

    if (!email) {
        console.error('No email found in checkout session');
        return;
    }

    console.log(`Processing checkout for ${email}, mode: ${mode}`);

    // Determine access type based on checkout mode and metadata
    const isMembership = mode === 'subscription';
    const isCourse = mode === 'payment';

    // Prepare entitlement data
    const entitlementData = {
        email: email.toLowerCase(),
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString()
    };

    if (isCourse) {
        entitlementData.course_access = true;
        entitlementData.course_purchased_at = new Date().toISOString();
    }

    if (isMembership) {
        entitlementData.member_access = true;
        entitlementData.membership_status = 'active';
    }

    // Upsert entitlement (insert or update if email exists)
    const { error } = await supabase
        .from('entitlements')
        .upsert(entitlementData, {
            onConflict: 'email'
        });

    if (error) {
        console.error('Error upserting entitlement:', error);
        throw error;
    }

    console.log(`Entitlement created/updated for ${email}`);
}

/**
 * Handle subscription updates - update membership status
 */
async function handleSubscriptionUpdated(subscription) {
    const customerId = subscription.customer;
    const status = subscription.status;

    console.log(`Subscription updated for customer ${customerId}: ${status}`);

    // Map Stripe status to our membership status
    let membershipStatus;
    let memberAccess;

    switch (status) {
        case 'active':
        case 'trialing':
            membershipStatus = 'active';
            memberAccess = true;
            break;
        case 'past_due':
            membershipStatus = 'past_due';
            memberAccess = true; // Still allow access during grace period
            break;
        case 'canceled':
        case 'unpaid':
            membershipStatus = 'canceled';
            memberAccess = false;
            break;
        default:
            membershipStatus = status;
            memberAccess = false;
    }

    const { error } = await supabase
        .from('entitlements')
        .update({
            member_access: memberAccess,
            membership_status: membershipStatus,
            updated_at: new Date().toISOString()
        })
        .eq('stripe_customer_id', customerId);

    if (error) {
        console.error('Error updating subscription status:', error);
        throw error;
    }

    console.log(`Membership status updated to ${membershipStatus}`);
}

/**
 * Handle subscription deletion - revoke member access
 */
async function handleSubscriptionDeleted(subscription) {
    const customerId = subscription.customer;

    console.log(`Subscription deleted for customer ${customerId}`);

    const { error } = await supabase
        .from('entitlements')
        .update({
            member_access: false,
            membership_status: 'canceled',
            updated_at: new Date().toISOString()
        })
        .eq('stripe_customer_id', customerId);

    if (error) {
        console.error('Error handling subscription deletion:', error);
        throw error;
    }

    console.log('Member access revoked');
}

/**
 * Handle payment failure - set membership to past_due
 */
async function handlePaymentFailed(invoice) {
    const customerId = invoice.customer;

    console.log(`Payment failed for customer ${customerId}`);

    // Only update if it's a subscription invoice
    if (invoice.subscription) {
        const { error } = await supabase
            .from('entitlements')
            .update({
                membership_status: 'past_due',
                updated_at: new Date().toISOString()
            })
            .eq('stripe_customer_id', customerId);

        if (error) {
            console.error('Error handling payment failure:', error);
            throw error;
        }

        console.log('Membership status set to past_due');
    }
}
