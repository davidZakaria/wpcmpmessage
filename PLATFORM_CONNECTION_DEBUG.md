# 🔧 Platform Connection Debug Guide

## Current Status
✅ Added comprehensive debugging to OAuth flows
✅ Enhanced error handling for token exchange
✅ Improved user info fetching with detailed logging

## 🚨 **CRITICAL: You Need a .env File**

Your app **cannot connect to any platforms** without proper API credentials. You need to create a `.env` file in your project root.

### **Step 1: Create .env File**

Create a file named `.env` in your project root (`C:\Users\David.s\wp2\.env`) with this content:

```bash
# === TWITTER/X API (OAuth 2.0) ===
# Get these from: https://developer.twitter.com/
VITE_TWITTER_CLIENT_ID=your_twitter_client_id_here
VITE_TWITTER_CLIENT_SECRET=your_twitter_client_secret_here

# === YOUTUBE API (Google OAuth 2.0) ===  
# Get these from: https://console.developers.google.com/
VITE_YOUTUBE_CLIENT_ID=your_youtube_client_id_here
VITE_YOUTUBE_CLIENT_SECRET=your_youtube_client_secret_here

# === OTHER PLATFORMS (Optional) ===
VITE_FACEBOOK_CLIENT_ID=your_facebook_app_id_here
VITE_FACEBOOK_CLIENT_SECRET=your_facebook_app_secret_here
VITE_INSTAGRAM_CLIENT_ID=your_instagram_client_id_here
VITE_INSTAGRAM_CLIENT_SECRET=your_instagram_client_secret_here
VITE_LINKEDIN_CLIENT_ID=your_linkedin_client_id_here
VITE_LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret_here
```

## 📋 **Platform Setup Instructions**

### **🐦 Twitter/X Setup**

1. **Go to Twitter Developer Portal**: https://developer.twitter.com/
2. **Create a new app** or select existing
3. **Configure OAuth 2.0**:
   - Go to **App Settings** → **Authentication settings**
   - **Enable OAuth 2.0** ✅
   - **Disable OAuth 1.0a** ❌
   - **App type**: "Web App, Automated App or Bot"
   - **Callback URL**: `http://localhost:3001/auth/twitter/callback`
   - **Website URL**: `http://localhost:3001`

4. **Get your credentials**:
   - Go to **Keys and tokens**
   - Copy **OAuth 2.0 Client ID** (NOT API Key)
   - Copy **Client Secret** (NOT API Secret Key)

### **🎥 YouTube Setup**

1. **Go to Google Cloud Console**: https://console.developers.google.com/
2. **Create a project** or select existing
3. **Enable YouTube Data API v3**:
   - Go to **APIs & Services** → **Library**
   - Search "YouTube Data API v3" → **Enable**

4. **Create OAuth credentials**:
   - Go to **APIs & Services** → **Credentials**
   - **Create Credentials** → **OAuth client ID**
   - Choose **Web application**
   - **Authorized redirect URI**: `http://localhost:3001/auth/youtube/callback`

5. **Configure OAuth consent screen** (required for YouTube)

## 🧪 **Testing Your Setup**

### **Step 1: Start the Server**
```bash
node server.js
```
Should show:
```
WhatsApp Backend Server running on port 3001
OAuth callbacks: http://localhost:3001/auth/{platform}/callback
```

### **Step 2: Start the Frontend**
```bash
npm run dev
```
Should show:
```
Local:   http://localhost:3001
```

### **Step 3: Test Connections**
1. Open http://localhost:3001
2. Navigate to **"Twitter & YouTube"** section
3. Click **"Connect"** for each platform
4. **Open browser console** (F12) to see detailed debug logs

## 🔍 **Debug Console Messages**

When working correctly, you should see:

```
🔗 Generating OAuth URL for twitter...
✅ Config found for twitter: {hasClientId: true, hasClientSecret: true, ...}
🔐 Generating PKCE for Twitter...
💾 Stored PKCE code verifier for Twitter
🚀 Generated OAuth URL for twitter: {...}

[After authorization]
🔄 Starting OAuth callback for twitter: {code: 'present', state: '...'}
🌐 Exchanging code for twitter token...
📡 Token exchange response for twitter: {status: 200, ok: true, ...}
✅ Successfully parsed token response for twitter: {...}
👤 Fetching user info for twitter...
🎉 Successfully connected to twitter!
```

## 🚨 **Common Error Messages & Solutions**

### **❌ "Missing API credentials for {platform}"**
- **Problem**: No `.env` file or missing credentials
- **Solution**: Create `.env` file with your API keys

### **❌ "Missing client ID for {platform}"**  
- **Problem**: Environment variables not loaded
- **Solution**: Restart both servers after creating `.env`

### **❌ "Token exchange failed: 401 Unauthorized"**
- **Problem**: Wrong API credentials or callback URL mismatch
- **Solution**: Double-check your credentials and callback URLs

### **❌ "No PKCE code verifier found for Twitter"**
- **Problem**: Session storage cleared or popup blocked
- **Solution**: Allow popups and try again

### **❌ "Failed to get user info: 403 Forbidden"**
- **Problem**: API not enabled or insufficient permissions
- **Solution**: Enable APIs and check app permissions

## 🔧 **Next Steps After Setup**

1. **Create your `.env` file** with real credentials
2. **Restart both servers** (`node server.js` and `npm run dev`)
3. **Test each platform connection** 
4. **Check browser console** for detailed debug information
5. **Report any specific error messages** you see

The enhanced debugging will now show you exactly where the connection process fails!
