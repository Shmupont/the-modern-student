# Stripe Setup Guide for The Modern Student

## 1. Stripe Dashboard Setup

### Create Products and Prices

1. **Log in to Stripe Dashboard** → Products

2. **Create Course Product (One-time)**
   - Click "Add Product"
   - Name: `The Modern Student Course`
   - Description: `Lifetime access to the complete AI course`
   - Pricing: One-time, $20.00 USD
   - Save and copy the **Price ID** (starts with `price_`)

3. **Create Membership Product (Subscription)**
   - Click "Add Product"
   - Name: `The Modern Student Membership`
   - Description: `Monthly membership with full access`
   - Pricing: Recurring, $5.99 USD / month
   - Save and copy the **Price ID** (starts with `price_`)

### Configure Customer Portal

1. Go to **Settings** → **Billing** → **Customer Portal**
2. Enable the following:
   - Cancel subscriptions
   - Update payment methods
   - View invoices
3. Set return URL: `https://your-domain.com/portal/index.html`
4. Save changes

## 2. Environment Variables

Set these in your Netlify dashboard under **Site settings** → **Environment variables**:

```
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxx
STRIPE_COURSE_PRICE_ID=price_xxxxxxxxxxxxxxxx
STRIPE_MEMBERSHIP_PRICE_ID=price_xxxxxxxxxxxxxxxx
```

**For testing**, use test mode keys:
```
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx
STRIPE_COURSE_PRICE_ID=price_test_xxxxxxxxxxxxxxxx
STRIPE_MEMBERSHIP_PRICE_ID=price_test_xxxxxxxxxxxxxxxx
```

## 3. Deploy to Netlify

### Option A: Deploy via Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Initialize site
cd the-modern-student
netlify init

# Deploy
netlify deploy --prod
```

### Option B: Deploy via GitHub

1. Push code to GitHub repository
2. Connect repository in Netlify dashboard
3. Set build settings:
   - Publish directory: `.`
   - Functions directory: `netlify/functions`
4. Add environment variables
5. Deploy

## 4. Test the Integration

### Test Mode Testing

Use Stripe test mode and test card numbers:

| Card Number | Result |
|-------------|--------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 0002 | Decline |
| 4000 0000 0000 3220 | 3D Secure |

Expiry: Any future date
CVC: Any 3 digits

### Testing Checklist

#### Course Purchase ($20 one-time)
- [ ] Click "Buy Course" on pricing page
- [ ] Complete Stripe Checkout with test card
- [ ] Verify redirect to success.html
- [ ] Verify "Course Access" shows as active
- [ ] Verify portal pages are accessible
- [ ] Verify course access persists after page refresh
- [ ] Verify pricing page shows "Course Owned" button

#### Membership Purchase ($5.99/month)
- [ ] Click "Join Membership" on pricing page
- [ ] Complete Stripe Checkout with test card
- [ ] Verify redirect to success.html
- [ ] Verify both "Course Access" and "Community Access" show as active
- [ ] Verify portal pages are accessible
- [ ] Verify "Manage Membership" button works (opens Stripe portal)

#### Customer Portal
- [ ] As a member, click "Manage Membership"
- [ ] Verify Stripe Customer Portal opens
- [ ] Test canceling subscription
- [ ] Verify return to portal after portal actions

#### Access Control
- [ ] Clear localStorage and verify portal shows locked state
- [ ] Verify locked state shows link to pricing page
- [ ] Verify logout clears access token

#### Edge Cases
- [ ] Navigate directly to success.html without session_id (should show error)
- [ ] Navigate to success.html with already-valid access (should show "already has access")
- [ ] Try to access portal without purchase (should show locked state)

## 5. Going Live

1. Switch to Stripe **live mode**
2. Create live products with same pricing
3. Update environment variables with live keys:
   - `STRIPE_SECRET_KEY` → live secret key
   - `STRIPE_COURSE_PRICE_ID` → live price ID
   - `STRIPE_MEMBERSHIP_PRICE_ID` → live price ID
4. Redeploy to Netlify
5. Test with a real $1 purchase (refund after testing)

## Troubleshooting

### "Failed to create checkout session"
- Check STRIPE_SECRET_KEY is set correctly
- Check price IDs match your Stripe products
- Check Netlify function logs for detailed errors

### "Verification failed" on success page
- Check session_id is in URL
- Check Stripe webhook/session status in dashboard
- Check Netlify function logs

### Portal won't open
- Check customer_id is stored in token
- Check Customer Portal is configured in Stripe dashboard

### Access not persisting
- Check browser localStorage is not blocked
- Check token expiration isn't in the past
- Check console for JavaScript errors

## Files Reference

```
the-modern-student/
├── netlify.toml              # Netlify config & redirects
├── netlify/functions/
│   ├── package.json          # Stripe dependency
│   ├── create-checkout-session.js
│   ├── verify-session.js
│   └── create-customer-portal-session.js
├── assets/
│   ├── checkout.js           # Frontend checkout logic
│   └── portal.js             # Portal access guard
├── success.html              # Post-checkout verification
└── pricing.html              # Buy buttons
```
