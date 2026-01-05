# Localhost Development Setup Guide

## Problem
When running the app on `localhost:5173`, Base44 redirects to login but then shows "This app was not found" because localhost is not configured as an allowed origin.

## Solution: Configure Localhost in Base44 Dashboard

### Step 1: Access Base44 App Settings
1. Go to: https://app.base44.com/apps/68682c1685e4902d2e91e89a
2. Log in to your Base44 account if prompted

### Step 2: Configure Allowed Origins
1. In your app dashboard, look for **Settings** or **Configuration** section
2. Find **Allowed Origins** or **Redirect URLs** or **CORS Settings**
3. Add the following URLs:
   - `http://localhost:5173`
   - `http://localhost:5173/`
   - (Optional) `http://127.0.0.1:5173` if you want to use IP address

### Step 3: Save and Test
1. Save your changes
2. Return to your local app at `http://localhost:5173`
3. The app should now properly redirect back after authentication

## Alternative: Use Base44 Preview URL

If you can't configure localhost, you can use Base44's preview URL instead:

**Preview URL:** https://app.base44.com/apps/68682c1685e4902d2e91e89a/editor/preview

This uses Base44's hosting and should work without additional configuration.

## Troubleshooting

### Still seeing "App not found"?
- Make sure you've saved the settings in Base44 dashboard
- Clear your browser cache and cookies
- Try logging out and logging back in
- Check that the app ID `68682c1685e4902d2e91e89a` matches in both places

### Authentication not working?
- Ensure you're logged into Base44 with an account that has access to this app
- Check browser console for any CORS or network errors
- Verify the app ID is correct in `src/api/base44Client.js`

