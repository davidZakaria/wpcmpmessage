# TikTok OAuth Troubleshooting Guide

## 🚨 Current Issue: `client_key` Error

You're getting a "client_key" error from TikTok, which means TikTok is rejecting your OAuth request. Here are the most common causes and solutions:

## 🔍 Step-by-Step Debugging

### 1. **Check Your TikTok App Configuration**

Go to [TikTok for Developers](https://developers.tiktok.com/) and verify:

#### ✅ **App Settings → Basic**
- **Client Key**: This should match your `VITE_TIKTOK_CLIENT_ID`
- **Client Secret**: This should match your `VITE_TIKTOK_CLIENT_SECRET`
- **App Status**: Make sure your app is **"Live"** or **"In Development"**

#### ✅ **OAuth → Settings**
- **Redirect URI**: Must be **exactly** `http://localhost:3001/auth/tiktok/callback`
- **Scopes**: Should include `user.info.basic`, `video.list`, `video.publish`

### 2. **Verify Your Environment Variables**

Check your `.env` file:
```bash
VITE_TIKTOK_CLIENT_ID=your_actual_client_key_here
VITE_TIKTOK_CLIENT_SECRET=your_actual_client_secret_here
```

**Important**: 
- The `VITE_TIKTOK_CLIENT_ID` should be your **Client Key** (not Client ID)
- Make sure there are no extra spaces or quotes
- Restart your development server after changing `.env`

### 3. **Check the Console Logs**

When you try to connect, look for these logs:
```
🎵 TikTok OAuth Debug Info: {
  clientId: "your_client_key",
  redirectUri: "http://localhost:3001/auth/tiktok/callback",
  scopes: ["user.info.basic", "video.list", "video.publish"],
  ...
}
```

**Verify**:
- `clientId` matches your TikTok app's Client Key
- `redirectUri` is exactly `http://localhost:3001/auth/tiktok/callback`
- `scopes` include the required permissions

### 4. **Common TikTok OAuth Issues**

#### ❌ **Issue 1: Wrong Redirect URI**
- **Problem**: Redirect URI doesn't match exactly
- **Solution**: In TikTok app settings, set redirect URI to: `http://localhost:3001/auth/tiktok/callback`
- **Note**: No trailing slash, exact match required

#### ❌ **Issue 2: App Not Live**
- **Problem**: TikTok app is in "Draft" status
- **Solution**: Go to TikTok Developer Console → App Settings → Change status to "Live" or "In Development"

#### ❌ **Issue 3: Wrong Client Key**
- **Problem**: Using Client ID instead of Client Key
- **Solution**: Use the **Client Key** (not Client ID) from your TikTok app settings

#### ❌ **Issue 4: Missing Scopes**
- **Problem**: App doesn't have required permissions
- **Solution**: In TikTok app settings, add scopes: `user.info.basic`, `video.list`, `video.publish`

#### ❌ **Issue 5: Development vs Production**
- **Problem**: Trying to use production app in development
- **Solution**: Make sure your app is set to "In Development" mode for localhost testing

### 5. **Test Your TikTok App Configuration**

1. **Go to TikTok Developer Console**
2. **Click on your app**
3. **Go to "OAuth" section**
4. **Click "Test OAuth" button**
5. **This should open a test OAuth flow**

If the test OAuth works but your app doesn't, the issue is in your app configuration.

### 6. **Alternative: Use TikTok's Test Environment**

If you're still having issues, try using TikTok's test environment:

1. **Create a new test app** in TikTok Developer Console
2. **Use test credentials** for development
3. **Set redirect URI** to `http://localhost:3001/auth/tiktok/callback`

## 🔧 Quick Fixes to Try

### Fix 1: Restart Everything
```bash
# Stop your development server
# Clear browser cache
# Restart development server
npm run dev
```

### Fix 2: Double-Check Redirect URI
- In TikTok app: `http://localhost:3001/auth/tiktok/callback`
- In your app: `http://localhost:3001/auth/tiktok/callback`
- **Must be identical** (no trailing slash, exact case)

### Fix 3: Verify Client Key Format
- TikTok Client Key should be a string like: `aw14z9ut5v77cz98`
- Make sure it's not wrapped in quotes in your `.env` file

### Fix 4: Check App Status
- Go to TikTok Developer Console
- Make sure your app status is "Live" or "In Development"
- If it's "Draft", change it to "In Development"

## 📞 Still Having Issues?

If you're still getting the `client_key` error after trying these steps:

1. **Check TikTok's OAuth Error Documentation**: https://developers.tiktok.com/doc/oauth-error-handling
2. **Contact TikTok Developer Support**: https://developers.tiktok.com/support
3. **Try creating a new TikTok app** with fresh credentials

## 🎯 Expected Behavior

When working correctly, you should see:
1. OAuth popup opens to TikTok
2. TikTok login page appears
3. After login, redirects back to your app
4. Console shows: `✅ Platform Testing - Accepting message from: https://www.tiktok.com`
5. Platform shows as "Connected" in your app

The `client_key` error means TikTok is rejecting your request before you even get to the login page, so the issue is definitely in the app configuration or credentials.
