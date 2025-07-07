# WhatsApp Business API Message Sender

A comprehensive web application for sending WhatsApp Business API messages with advanced image support and template management.

## 🚀 Features

### Core Functionality
- **WhatsApp Business API Integration** - Complete integration with Meta's WhatsApp Business API
- **Template Messages** - Send approved template messages with validation
- **Direct Image Messaging** - Bypass template complexity with direct image messages
- **Bulk Messaging** - Send to multiple recipients from CSV/TXT files
- **Real-time Status Tracking** - Monitor message delivery status

### Image Support
- **Multiple Upload Services** - ImgBB, PostImages with automatic fallback
- **Manual Upload Options** - Fallback to manual hosting services
- **Image Preview** - Preview images before sending
- **Caption Support** - Add captions to image messages (up to 1024 characters)

### Advanced Features
- **Template Validation** - Check template structure and requirements
- **Account Verification** - Verify your WhatsApp Business account status
- **Comprehensive Diagnostics** - Debug connection and API issues
- **Error Handling** - Detailed error messages and recovery suggestions
- **Modern UI** - Clean, responsive interface built with Chakra UI

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 16+ installed
- WhatsApp Business API account
- Access token from Meta Business
- Phone Number ID from WhatsApp Business

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/davidZakaria/wpcmpmessage.git
   cd wpcmpmessage
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   - Navigate to `http://localhost:3000`

### WhatsApp Business API Setup

1. **Get your Access Token**
   - Go to [Meta for Developers](https://developers.facebook.com/)
   - Create a WhatsApp Business app
   - Generate an access token

2. **Get your Phone Number ID**
   - In your WhatsApp Business app dashboard
   - Go to API Setup → Phone Numbers
   - Copy the Phone Number ID

3. **Test your setup**
   - Use the "Test Connection" button in the app
   - Verify with "Find My Phone Numbers"

## 📱 Usage Guide

### Basic Template Messaging

1. **Enter API credentials**
   - Access Token
   - Phone Number ID

2. **Configure template**
   - Template name
   - Language (default: en_US)
   - Check "Template contains media" if needed

3. **Add recipients**
   - Upload CSV/TXT file, or
   - Enter phone numbers manually (international format: +1234567890)

4. **Send messages**
   - Click "Send Template Messages"

### Direct Image Messaging (Recommended)

1. **Enable direct images**
   - Check "📸 Send images as direct messages"

2. **Upload image**
   - Option 1: Paste image URL directly
   - Option 2: Upload file → Click "Upload Image"

3. **Add caption** (optional)
   - Enter caption text (max 1024 characters)

4. **Choose mode**
   - "Send image only" - Just images
   - Leave unchecked - Both images and templates

5. **Send messages**
   - Click "📸 Send Images Only" or "🚀 Send Images + Templates"

### Troubleshooting Tools

- **Test Connection** - Verify API credentials
- **Check Template Structure** - Analyze template requirements
- **Test Direct Image Message** - Verify image sending
- **Run Comprehensive Diagnostics** - Debug issues
- **Check Account Verification** - Verify account status

## 🎯 Image Upload Options

### Automatic Upload (Recommended)
- **ImgBB** - Primary hosting service
- **PostImages** - Backup service
- Automatic fallback between services

### Manual Upload (Fallback)
If automatic upload fails:
1. Upload to any hosting service:
   - [Imgur](https://imgur.com/)
   - [ImgBB](https://imgbb.com/)
   - [PostImages](https://postimages.org/)
   - [ImageUpload](https://imageupload.io/)
2. Copy the direct image link
3. Paste in the "Image URL" field

## 📋 File Formats

### Phone Numbers
- **CSV/TXT files** supported
- **Format**: One number per line
- **International format**: +1234567890
- **Example**:
  ```
  +1234567890
  +9876543210
  +1122334455
  ```

### Images
- **Supported formats**: PNG, JPG, GIF, WebP
- **Maximum size**: 5MB (WhatsApp limit)
- **Recommended**: High-quality images under 2MB

## 🔧 Technical Details

### Built With
- **React 18** - Frontend framework
- **TypeScript** - Type safety
- **Chakra UI** - Component library
- **Vite** - Build tool
- **Axios** - HTTP client

### API Integration
- **WhatsApp Business API v22.0**
- **Meta Graph API**
- **Image hosting APIs** (ImgBB, PostImages)

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🚨 Common Issues & Solutions

### Image Upload Fails
- **Solution**: Use manual upload option
- **Cause**: CORS restrictions or service unavailable
- **Fix**: Upload to hosting service manually

### Template Not Found
- **Solution**: Check template name and language
- **Cause**: Template not approved or wrong name
- **Fix**: Use "List All Available Templates" button

### Connection Failed
- **Solution**: Verify API credentials
- **Cause**: Invalid access token or phone number ID
- **Fix**: Check Meta Business Manager settings

### Messages Not Delivered
- **Solution**: Check account verification status
- **Cause**: Unverified business account
- **Fix**: Complete WhatsApp Business verification

## 📞 Support

For issues or questions:
1. Check the troubleshooting tools in the app
2. Review the comprehensive diagnostics
3. Verify your WhatsApp Business account status
4. Check Meta's WhatsApp Business API documentation

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

**Note**: This application requires a valid WhatsApp Business API account. Free tier accounts have limitations on message volume and features. 