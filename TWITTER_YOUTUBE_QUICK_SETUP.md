# 🐦 Twitter & YouTube Quick Setup Guide

Having trouble connecting Twitter and YouTube? Let's fix that! Follow this step-by-step guide to get both platforms connected.

## 🎯 **Quick Diagnosis**

First, let's check what's wrong:

1. **Go to your app**: http://localhost:3001
2. **Click "Twitter & YouTube"** in the sidebar (new section I just added)
3. **Click "Test Config"** for both platforms
4. **Check the status badges** - they'll show exactly what's missing

## 🐦 **Twitter/X Setup**

### **Step 1: Get Twitter Developer Access**
1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Sign in with your Twitter account
3. Apply for developer access (if you haven't already)
4. Create a new project and app

### **Step 2: Configure Your Twitter App**
1. In your Twitter app dashboard:
   - Go to **"App settings"** → **"Keys and tokens"**
   - Copy your **Client ID** and **Client Secret**
   
2. Go to **"App settings"** → **"Authentication settings"**:
   - Enable **OAuth 2.0**
   - Set **App type** to "Web App"
   - Add **Redirect URI**: `http://localhost:3001/auth/twitter/callback`
   - Set **Website URL**: `http://localhost:3001`

### **Step 3: Add to Environment**
Add these to your `.env` file:
```bash
VITE_TWITTER_CLIENT_ID=your_twitter_client_id_here
VITE_TWITTER_CLIENT_SECRET=your_twitter_client_secret_here
```

## 🎥 **YouTube Setup**

### **Step 1: Google Cloud Console**
1. Go to [Google Cloud Console](https://console.developers.google.com/)
2. Create a new project or select existing
3. Enable **YouTube Data API v3**:
   - Go to **"APIs & Services"** → **"Library"**
   - Search for "YouTube Data API v3"
   - Click **"Enable"**

### **Step 2: Create OAuth Credentials**
1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. Choose **"Web application"**
4. Add **Authorized redirect URI**: `http://localhost:3001/auth/youtube/callback`
5. Copy your **Client ID** and **Client Secret**

### **Step 3: Configure OAuth Consent Screen**
1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Choose **"External"** (for testing)
3. Fill in required fields:
   - App name: "Your App Name"
   - User support email: your email
   - Developer contact: your email
4. Add scopes: `https://www.googleapis.com/auth/youtube.readonly`

### **Step 4: Add to Environment**
Add these to your `.env` file:
```bash
VITE_YOUTUBE_CLIENT_ID=your_google_client_id_here
VITE_YOUTUBE_CLIENT_SECRET=your_google_client_secret_here
```

## 🔧 **Complete .env File Template**

Your `.env` file should look like this:
```bash
# Twitter API v2
VITE_TWITTER_CLIENT_ID=your_actual_twitter_client_id
VITE_TWITTER_CLIENT_SECRET=your_actual_twitter_client_secret

# YouTube Data API v3 (Google)
VITE_YOUTUBE_CLIENT_ID=your_actual_google_client_id
VITE_YOUTUBE_CLIENT_SECRET=your_actual_google_client_secret

# Other platforms (for later)
VITE_FACEBOOK_CLIENT_ID=your_facebook_app_id
VITE_FACEBOOK_CLIENT_SECRET=your_facebook_app_secret
VITE_INSTAGRAM_CLIENT_ID=your_instagram_client_id
VITE_INSTAGRAM_CLIENT_SECRET=your_instagram_client_secret
VITE_LINKEDIN_CLIENT_ID=your_linkedin_client_id
VITE_LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
```

## ⚡ **Testing Your Setup**

After adding credentials:

1. **Restart your dev server** (the .env changes require restart)
2. **Go to "Twitter & YouTube" section**
3. **Click "Test Config"** for both platforms
4. **Look for green "Configured" badges**
5. **Click "Connect"** to test OAuth flow

## 🚨 **Common Issues & Solutions**

### **Twitter Issues:**
- **"App not approved for OAuth 2.0"**: Enable OAuth 2.0 in app settings
- **"Redirect URI mismatch"**: Make sure you added exactly `http://localhost:3001/auth/twitter/callback`
- **"Invalid client credentials"**: Double-check your Client ID and Secret

### **YouTube Issues:**
- **"YouTube Data API not enabled"**: Enable the API in Google Cloud Console
- **"OAuth consent screen not configured"**: Complete the consent screen setup
- **"Redirect URI not authorized"**: Add the exact redirect URI in Google Cloud Console
- **"Invalid client credentials"**: Verify your Google OAuth credentials

### **General Issues:**
- **Environment variables not loading**: Restart the dev server after editing .env
- **Popup blocked**: Allow popups for localhost in your browser
- **CORS errors**: These are expected, the OAuth popup should still work

## 🎯 **Expected Results**

When working correctly:
- ✅ **Status badges** show "Configured" 
- ✅ **Test Config** passes
- ✅ **Connect button** opens OAuth popup
- ✅ **After OAuth** you see "Connected" status
- ✅ **Platform shows** user info and connection details

## 🆘 **Still Having Issues?**

1. **Check browser console** for detailed error messages
2. **Use the "Test Config" button** to see specific issues
3. **Verify redirect URIs** match exactly (including http vs https)
4. **Make sure APIs are enabled** in the respective developer consoles
5. **Check that your apps are not suspended** or restricted

## 🎉 **Success!**

Once connected, you'll be able to:
- ✅ **See real Twitter/YouTube content** in Social Moderation
- ✅ **Apply AI moderation** to your social feeds
- ✅ **Get analytics** from your connected accounts
- ✅ **Manage content** across platforms

---

**Need more help?** Check the detailed setup in the "Twitter & YouTube" section of your app - it has step-by-step guides and troubleshooting for each platform!
