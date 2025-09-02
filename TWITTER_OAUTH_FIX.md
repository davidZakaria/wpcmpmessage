# 🐦 Twitter OAuth Fix Guide

The "Something went wrong" error you're seeing is a **Twitter app configuration issue**. Here's how to fix it:

## 🚨 **Root Cause**
Twitter's OAuth error means your app isn't properly configured for OAuth 2.0 authentication.

## 🔧 **Step-by-Step Fix**

### **Step 1: Fix Twitter App Settings**

1. **Go to Twitter Developer Portal**: https://developer.twitter.com/
2. **Select your app** → **App settings**
3. **Click "Edit" on Authentication settings**

### **Step 2: Configure OAuth 2.0 Settings**

**CRITICAL - Set these EXACTLY:**

```
✅ App type: Web App, Automated App or Bot
✅ OAuth 2.0: ENABLED
✅ OAuth 1.0a: DISABLED (turn this OFF)

✅ Callback URLs / Redirect URLs:
   http://localhost:3001/auth/twitter/callback

✅ Website URL:
   http://localhost:3001

✅ App permissions: Read
```

### **Step 3: Get the Correct Credentials**

1. **Go to "Keys and tokens" tab**
2. **Copy these values:**
   - **OAuth 2.0 Client ID** (NOT API Key)
   - **Client Secret** (NOT API Secret Key)

### **Step 4: Update Your .env File**

```bash
# Use OAuth 2.0 credentials (NOT API v1.1 keys)
VITE_TWITTER_CLIENT_ID=your_oauth2_client_id_here
VITE_TWITTER_CLIENT_SECRET=your_oauth2_client_secret_here
```

### **Step 5: Restart Your Servers**

```bash
# Stop current servers (Ctrl+C)
# Then restart both:
npm run dev          # Frontend (one terminal)
node server.js       # Backend (another terminal)
```

## ⚠️ **Common Mistakes**

### **❌ Wrong Credentials**
- Don't use API Key/Secret (v1.1)
- Use OAuth 2.0 Client ID/Secret

### **❌ Wrong App Type**
- Must be "Web App, Automated App or Bot"
- NOT "Native App"

### **❌ Wrong Callback URL**
- Must be EXACTLY: `http://localhost:3001/auth/twitter/callback`
- No trailing slash
- Must match exactly

### **❌ OAuth 1.0a Enabled**
- Turn OFF OAuth 1.0a
- Only use OAuth 2.0

## 🔍 **Verification Steps**

1. **Check App Settings:**
   ```
   ✅ OAuth 2.0: Enabled
   ✅ OAuth 1.0a: Disabled
   ✅ App type: Web App
   ✅ Callback URL: http://localhost:3001/auth/twitter/callback
   ```

2. **Test Configuration:**
   - Go to your app → "Twitter & YouTube" section
   - Click "Test Config" for Twitter
   - Should show "Configured" badges

3. **Test Connection:**
   - Click "Connect" for Twitter
   - Should open Twitter OAuth popup
   - Should NOT show "Something went wrong"

## 🎯 **Expected OAuth Flow**

1. Click "Connect" → Opens popup
2. Twitter asks: "Authorize [YourApp] to access your account?"
3. Click "Authorize app"
4. Popup closes → Shows "Connected" status

## 🚨 **Still Having Issues?**

### **Check Your App Status:**
1. **App suspended?** Check Twitter Developer Portal
2. **App not approved?** Some apps need manual review
3. **Rate limited?** Wait 15 minutes and try again

### **Debug Steps:**
1. **Browser Console:** Check for detailed error messages
2. **Network Tab:** Look for failed requests
3. **Twitter Developer Portal:** Check app status and limits

### **Alternative: Create New App**
If your current app is broken:
1. Create a new Twitter app
2. Use the exact settings above
3. Get new OAuth 2.0 credentials
4. Update .env file

## 📝 **Complete .env Template**

```bash
# Twitter OAuth 2.0 (NOT API v1.1)
VITE_TWITTER_CLIENT_ID=your_oauth2_client_id_here
VITE_TWITTER_CLIENT_SECRET=your_oauth2_client_secret_here

# YouTube (Google OAuth 2.0)
VITE_YOUTUBE_CLIENT_ID=your_google_client_id_here
VITE_YOUTUBE_CLIENT_SECRET=your_google_client_secret_here

# Other platforms
VITE_FACEBOOK_CLIENT_ID=your_facebook_app_id
VITE_FACEBOOK_CLIENT_SECRET=your_facebook_app_secret
VITE_INSTAGRAM_CLIENT_ID=your_instagram_client_id
VITE_INSTAGRAM_CLIENT_SECRET=your_instagram_client_secret
VITE_LINKEDIN_CLIENT_ID=your_linkedin_client_id
VITE_LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
```

---

**The key is using OAuth 2.0 credentials, not API v1.1 keys!** 🔑
