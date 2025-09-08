# 🎥 YouTube OAuth Fix Guide

## 🚨 **Error: "redirect_uri_mismatch"**

You're getting this error because the redirect URI in your Google Cloud Console doesn't match what your app is sending.

## 🔧 **Step-by-Step Fix**

### **Step 1: Google Cloud Console Setup**

1. **Go to Google Cloud Console**: https://console.developers.google.com/
2. **Select your project** (or create a new one)

### **Step 2: Enable YouTube Data API v3**

1. **Go to "APIs & Services" → "Library"**
2. **Search for "YouTube Data API v3"**
3. **Click on it and click "ENABLE"** if not already enabled

### **Step 3: Create/Configure OAuth Credentials**

1. **Go to "APIs & Services" → "Credentials"**
2. **If you don't have OAuth credentials yet**:
   - Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
   - Choose **"Web application"**
   - Give it a name (e.g., "Social Media App")

3. **Configure the OAuth client**:
   - **Application type**: Web application
   - **Name**: Your app name
   - **Authorized JavaScript origins**: `http://localhost:3001`
   - **Authorized redirect URIs**: `http://localhost:3001/auth/youtube/callback`

4. **Click "SAVE"**
5. **Copy your Client ID and Client Secret**

### **Step 4: Configure OAuth Consent Screen**

1. **Go to "APIs & Services" → "OAuth consent screen"**
2. **Choose "External" user type** (for testing)
3. **Fill in required fields**:
   - **App name**: Your app name
   - **User support email**: Your email
   - **Developer contact email**: Your email
4. **Click "SAVE AND CONTINUE"**

5. **Add Scopes**:
   - Click **"ADD OR REMOVE SCOPES"**
   - Search for and add: `https://www.googleapis.com/auth/youtube.readonly`
   - Click **"UPDATE"** and **"SAVE AND CONTINUE"**

6. **Add Test Users** (required for external apps):
   - Click **"ADD USERS"**
   - Add your email address
   - Click **"SAVE AND CONTINUE"**

### **Step 5: Update Your .env File**

Add your YouTube credentials to your `.env` file:

```bash
# YouTube API credentials (Google OAuth 2.0)
VITE_YOUTUBE_CLIENT_ID=your_google_client_id_here
VITE_YOUTUBE_CLIENT_SECRET=your_google_client_secret_here
```

### **Step 6: Restart Your Servers**

```bash
# Stop current servers (Ctrl+C)
# Then restart both:
node server.js       # Backend (port 3001)
npm run dev          # Frontend (port 3001)
```

## 🧪 **Test the Connection**

1. **Open browser console** (F12) to see debug messages
2. **Try connecting to YouTube**
3. **Look for the debug message**:
   ```
   🎥 YouTube OAuth Debug: {
     currentOrigin: "http://localhost:3001",
     fullRedirectUri: "http://localhost:3001/auth/youtube/callback",
     expectedInGoogleConsole: "http://localhost:3001/auth/youtube/callback"
   }
   ```
4. **Verify the redirect URIs match exactly**

## ⚠️ **Common Issues**

### **Issue: "App not verified"**
- **Solution**: Add your email as a test user in OAuth consent screen
- For production, you'll need Google verification

### **Issue: "Access blocked: This app's request is invalid"**
- **Solution**: Check that YouTube Data API v3 is enabled
- Verify OAuth consent screen is properly configured

### **Issue: Still getting redirect_uri_mismatch**
- **Solution**: Double-check the exact URL in Google Console
- Must be exactly: `http://localhost:3001/auth/youtube/callback`
- No trailing slash, no extra characters

### **Issue: "Scope not authorized"**
- **Solution**: Add the YouTube scope in OAuth consent screen
- Scope: `https://www.googleapis.com/auth/youtube.readonly`

## 🎯 **Expected Flow**

1. **Click "Connect" for YouTube**
2. **OAuth popup opens** with Google sign-in
3. **Google asks for permission** to access YouTube data
4. **Click "Allow"**
5. **Popup shows success page** and closes
6. **Platform shows "Connected" status**

## 📋 **Checklist**

- ✅ YouTube Data API v3 enabled
- ✅ OAuth client created with correct redirect URI
- ✅ OAuth consent screen configured
- ✅ Test user added (your email)
- ✅ Credentials added to .env file
- ✅ Servers restarted

After following these steps, YouTube OAuth should work without the redirect_uri_mismatch error!
