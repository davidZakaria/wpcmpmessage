# Social Media Chat & Posting Implementation Guide

This guide explains how to implement and use the new **Social Chat** and **Post Creator** tabs in your social media management platform.

## 🎯 Overview

The implementation includes two major new features:

1. **Social Chat Tab** - Unified messaging interface across multiple platforms
2. **Post Creator Tab** - Multi-platform content creation and scheduling

## 📁 File Structure

```
src/
├── components/
│   ├── SocialChatTab.tsx          # Chat interface component
│   └── SocialPostingTab.tsx       # Posting interface component
├── services/
│   ├── socialMessaging.ts         # Messaging API service
│   └── socialPosting.ts          # Posting API service
└── SocialModerationSection.tsx    # Updated main component
```

## 🔧 Implementation Details

### 1. Social Chat Tab Features

#### ✅ **Implemented Features:**
- **Unified Conversation List**: View conversations from all connected platforms
- **Platform-Specific Icons**: Visual indicators for each platform
- **Real-time Message Interface**: Send and receive messages
- **Online Status Indicators**: See who's online
- **Message Status Tracking**: Sent, delivered, read indicators
- **Media Support**: Image, video, and file attachments
- **Search & Filter**: Find conversations quickly
- **Platform Filtering**: Filter by specific platforms

#### 🔌 **Supported Platforms:**
- **Facebook Messenger** ✅ (Full API support)
- **Instagram Direct** ⚠️ (Requires business API)
- **LinkedIn Messaging** ⚠️ (Requires special permissions)
- **Snapchat** ❌ (Limited API)
- **TikTok** ❌ (No public messaging API)

#### 💻 **Usage Example:**
```tsx
<SocialChatTab 
  connectedPlatforms={['facebook', 'instagram', 'linkedin']}
/>
```

### 2. Post Creator Tab Features

#### ✅ **Implemented Features:**
- **Multi-Platform Selection**: Choose which platforms to post to
- **Rich Text Editor**: Full text composition with character limits
- **Media Upload**: Support for images and videos
- **Hashtag Management**: Add and manage hashtags
- **Mention System**: Tag users across platforms
- **Post Scheduling**: Schedule posts for later
- **Content Preview**: See how posts will look on each platform
- **Draft System**: Save and load drafts
- **Character Limit Validation**: Platform-specific limits
- **Post History**: Track published and scheduled posts

#### 🔌 **Supported Platforms:**
- **Facebook** ✅ (Full posting support)
- **Instagram** ⚠️ (Requires business API)
- **Twitter** ✅ (Via server-side API)
- **LinkedIn** ✅ (Via server-side API)
- **TikTok** ❌ (Requires special approval)
- **Snapchat** ❌ (Limited API)

#### 💻 **Usage Example:**
```tsx
<SocialPostingTab 
  connectedPlatforms={['facebook', 'twitter', 'linkedin']}
/>
```

## 🚀 Getting Started

### Step 1: Platform Configuration

Update your platform configurations to include the new platforms:

```typescript
// In SocialModerationSection.tsx
const [platforms, setPlatforms] = useState<Platform[]>([
  { id: 'facebook', name: 'Facebook', icon: FaFacebook, enabled: true, connected: false },
  { id: 'instagram', name: 'Instagram', icon: FaInstagram, enabled: true, connected: false },
  { id: 'twitter', name: 'Twitter', icon: FaTwitter, enabled: true, connected: false },
  { id: 'linkedin', name: 'LinkedIn', icon: FaLinkedin, enabled: true, connected: false },
  { id: 'tiktok', name: 'TikTok', icon: FaTiktok, enabled: true, connected: false },
  { id: 'snapchat', name: 'Snapchat', icon: FaSnapchat, enabled: true, connected: false },
]);
```

### Step 2: Add Required Dependencies

Make sure you have all required React Icons:

```bash
npm install react-icons
```

### Step 3: Server-Side API Endpoints

Add these endpoints to your `server.js`:

```javascript
// Twitter posting endpoint
app.post('/api/twitter/post', async (req, res) => {
  // Implementation for Twitter posting
});

// LinkedIn posting endpoint
app.post('/api/linkedin/post', async (req, res) => {
  // Implementation for LinkedIn posting
});

// Facebook Messenger endpoint
app.get('/api/facebook/conversations', async (req, res) => {
  // Implementation for Facebook conversations
});
```

## 📊 Platform-Specific Limits

### Character Limits:
- **Facebook**: 63,206 characters
- **Instagram**: 2,200 characters
- **Twitter**: 280 characters
- **LinkedIn**: 3,000 characters
- **TikTok**: 300 characters
- **Snapchat**: 250 characters

### Media Limits:
- **Facebook**: 10 files, 4GB video, 100MB image
- **Instagram**: 10 files, 4GB video, 100MB image
- **Twitter**: 4 files, 512MB video, 5MB image
- **LinkedIn**: 9 files, 5GB video, 100MB image
- **TikTok**: 1 file, 4GB video, 10MB image
- **Snapchat**: 1 file, 1GB video, 10MB image

## 🔐 API Requirements & Permissions

### Facebook/Instagram:
- **Required Scopes**: `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`
- **Business Verification**: Required for advanced features
- **Webhook Setup**: For real-time message notifications

### Twitter:
- **API Version**: v2 with OAuth 2.0
- **Required Scopes**: `tweet.write`, `users.read`, `dm.write`, `dm.read`
- **Rate Limits**: 300 requests per 15 minutes

### LinkedIn:
- **Required Scopes**: `w_member_social`, `r_member_social`, `rw_organization_admin`
- **Partner Program**: May be required for full access
- **Content Publishing API**: Required for posting

### TikTok:
- **Business API**: Requires special approval
- **Content Posting**: Very limited availability
- **Messaging**: Not available via public API

### Snapchat:
- **Marketing API**: Mainly for advertising
- **Content Publishing**: Limited availability
- **Messaging**: Not available via public API

## 🛠️ Customization Options

### 1. Styling Customization

```tsx
// Custom theme colors for platforms
const platformColors = {
  facebook: 'blue.500',
  instagram: 'pink.500',
  snapchat: 'yellow.400',
  linkedin: 'blue.600',
  tiktok: 'gray.800',
};
```

### 2. Feature Toggles

```tsx
// Enable/disable features per platform
const platformFeatures = {
  facebook: { messaging: true, posting: true, scheduling: true },
  instagram: { messaging: false, posting: true, scheduling: true },
  linkedin: { messaging: false, posting: true, scheduling: true },
  // ...
};
```

### 3. Custom Message Templates

```tsx
// Pre-defined message templates
const messageTemplates = [
  { name: 'Welcome', content: 'Welcome to our community!' },
  { name: 'Support', content: 'How can we help you today?' },
  { name: 'Follow Up', content: 'Thanks for your interest!' },
];
```

## 📈 Analytics & Monitoring

### Post Performance Tracking:
```typescript
interface PostAnalytics {
  likes: number;
  shares: number;
  comments: number;
  views: number;
  clickThroughRate: number;
  engagementRate: number;
}
```

### Message Analytics:
```typescript
interface MessageAnalytics {
  totalConversations: number;
  responseTime: number;
  messagesSent: number;
  messagesReceived: number;
  activeConversations: number;
}
```

## 🚨 Error Handling

### Common Error Scenarios:
1. **Platform Disconnection**: Handle token expiration
2. **Rate Limiting**: Implement retry logic with backoff
3. **Content Violations**: Handle platform-specific content policies
4. **Media Upload Failures**: Provide fallback options
5. **Network Issues**: Implement offline support

### Error Recovery:
```typescript
try {
  await socialPosting.publishPost(postOptions);
} catch (error) {
  if (error.message.includes('rate limit')) {
    // Implement retry with exponential backoff
    await retryWithBackoff(() => socialPosting.publishPost(postOptions));
  } else if (error.message.includes('token expired')) {
    // Refresh token and retry
    await platformAuth.refreshToken(platform);
    await socialPosting.publishPost(postOptions);
  }
}
```

## 🔄 Real-time Updates

### WebSocket Integration:
```typescript
// Real-time message updates
const socket = io('ws://localhost:3002');

socket.on('new_message', (message: SocialMessage) => {
  setMessages(prev => [...prev, message]);
});

socket.on('message_status_update', (update) => {
  updateMessageStatus(update.messageId, update.status);
});
```

## 📱 Mobile Responsiveness

The components are built with mobile-first design:
- **Responsive Grid Layouts**: Adapts to screen size
- **Touch-Friendly Controls**: Large buttons and touch targets
- **Swipe Gestures**: For conversation navigation
- **Optimized Media Handling**: Compressed uploads on mobile

## 🧪 Testing

### Unit Tests:
```typescript
describe('SocialPostingTab', () => {
  test('validates character limits correctly', () => {
    const result = socialPosting.validatePost({
      text: 'A'.repeat(300),
      platforms: ['twitter']
    });
    expect(result.valid).toBe(false);
  });
});
```

### Integration Tests:
```typescript
describe('Platform Integration', () => {
  test('publishes to multiple platforms', async () => {
    const result = await socialPosting.publishPost({
      text: 'Test post',
      platforms: ['facebook', 'twitter']
    });
    expect(result.status).toBe('published');
  });
});
```

## 🔮 Future Enhancements

### Planned Features:
1. **AI-Powered Content Suggestions**
2. **Advanced Scheduling with Optimal Timing**
3. **Bulk Message Operations**
4. **Custom Chatbot Integration**
5. **Advanced Analytics Dashboard**
6. **Team Collaboration Features**
7. **Content Calendar View**
8. **Automated Response Templates**

## 📞 Support & Troubleshooting

### Common Issues:

1. **"Platform not connected"**
   - Solution: Check OAuth tokens and refresh if needed

2. **"Character limit exceeded"**
   - Solution: Use the built-in validation and character counter

3. **"Media upload failed"**
   - Solution: Check file size and format requirements

4. **"Rate limit exceeded"**
   - Solution: Implement proper rate limiting and retry logic

### Debug Mode:
```typescript
// Enable debug logging
localStorage.setItem('social_debug', 'true');
```

## 📄 License & Credits

This implementation uses:
- **Chakra UI** for component styling
- **React Icons** for platform icons
- **Platform APIs** for social media integration

---

**Need Help?** Check the console logs for detailed error messages and API responses. All services include comprehensive logging for debugging purposes.
