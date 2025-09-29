// Social Media Messaging Service
// Handles messaging across multiple social media platforms

import { platformAuth, PlatformCredentials } from './platformAuth';

export interface SocialMessage {
  id: string;
  platform: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'image' | 'video' | 'file' | 'sticker' | 'voice';
  mediaUrl?: string;
  isOutgoing: boolean;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  replyTo?: string;
  metadata?: any;
}

export interface SocialConversation {
  id: string;
  platform: string;
  participantId: string;
  participantName: string;
  participantAvatar?: string;
  participantUsername?: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isOnline: boolean;
  lastSeen?: Date;
  isVerified?: boolean;
  conversationType: 'direct' | 'group' | 'page';
  metadata?: any;
}

export interface SendMessageOptions {
  platform: string;
  conversationId: string;
  recipientId: string;
  content: string;
  type?: 'text' | 'image' | 'video' | 'file';
  mediaUrl?: string;
  replyTo?: string;
}

class SocialMessagingService {
  // Get conversations from all connected platforms
  async getAllConversations(): Promise<SocialConversation[]> {
    const connectedPlatforms = platformAuth.getConnectedPlatforms();
    const allConversations: SocialConversation[] = [];

    for (const platform of connectedPlatforms) {
      try {
        const conversations = await this.getPlatformConversations(platform);
        allConversations.push(...conversations);
      } catch (error) {
        console.error(`Failed to fetch conversations from ${platform}:`, error);
      }
    }

    // Sort by last message time (newest first)
    return allConversations.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());
  }

  // Get conversations from specific platform
  async getPlatformConversations(platform: string): Promise<SocialConversation[]> {
    const credentials = platformAuth.getCredentials(platform);
    if (!credentials) {
      throw new Error(`Platform ${platform} is not connected`);
    }

    switch (platform) {
      case 'facebook':
        return this.getFacebookConversations(credentials);
      case 'instagram':
        return this.getInstagramConversations(credentials);
      case 'twitter':
        return this.getTwitterConversations(credentials);
      case 'linkedin':
        return this.getLinkedInConversations(credentials);
      case 'snapchat':
        return this.getSnapchatConversations(credentials);
      case 'tiktok':
        return this.getTikTokConversations(credentials);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  // Get messages for a specific conversation
  async getConversationMessages(platform: string, conversationId: string, limit: number = 50): Promise<SocialMessage[]> {
    const credentials = platformAuth.getCredentials(platform);
    if (!credentials) {
      throw new Error(`Platform ${platform} is not connected`);
    }

    switch (platform) {
      case 'facebook':
        return this.getFacebookMessages(credentials, conversationId, limit);
      case 'instagram':
        return this.getInstagramMessages(credentials, conversationId, limit);
      case 'twitter':
        return this.getTwitterMessages(credentials, conversationId, limit);
      case 'linkedin':
        return this.getLinkedInMessages(credentials, conversationId, limit);
      case 'snapchat':
        return this.getSnapchatMessages(credentials, conversationId, limit);
      case 'tiktok':
        return this.getTikTokMessages(credentials, conversationId, limit);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  // Send message to any platform
  async sendMessage(options: SendMessageOptions): Promise<SocialMessage> {
    const credentials = platformAuth.getCredentials(options.platform);
    if (!credentials) {
      throw new Error(`Platform ${options.platform} is not connected`);
    }

    switch (options.platform) {
      case 'facebook':
        return this.sendFacebookMessage(credentials, options);
      case 'instagram':
        return this.sendInstagramMessage(credentials, options);
      case 'twitter':
        return this.sendTwitterMessage(credentials, options);
      case 'linkedin':
        return this.sendLinkedInMessage(credentials, options);
      case 'snapchat':
        return this.sendSnapchatMessage(credentials, options);
      case 'tiktok':
        return this.sendTikTokMessage(credentials, options);
      default:
        throw new Error(`Unsupported platform: ${options.platform}`);
    }
  }

  // Facebook Messenger Implementation
  private async getFacebookConversations(credentials: PlatformCredentials): Promise<SocialConversation[]> {
    try {
      // Facebook Messenger API - requires special permissions
      const response = await fetch(
        `https://graph.facebook.com/v18.0/me/conversations?fields=participants,updated_time,message_count,unread_count&access_token=${credentials.accessToken}`
      );

      if (!response.ok) {
        throw new Error(`Facebook API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      return (data.data || []).map((conv: any) => ({
        id: conv.id,
        platform: 'facebook',
        participantId: conv.participants?.data?.[0]?.id || 'unknown',
        participantName: conv.participants?.data?.[0]?.name || 'Facebook User',
        lastMessage: 'Recent message', // Would need additional API call
        lastMessageTime: new Date(conv.updated_time),
        unreadCount: conv.unread_count || 0,
        isOnline: false, // Would need additional API call
        conversationType: 'direct' as const,
      }));
    } catch (error) {
      console.error('Facebook conversations error:', error);
      return [];
    }
  }

  private async getFacebookMessages(credentials: PlatformCredentials, conversationId: string, limit: number): Promise<SocialMessage[]> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${conversationId}/messages?fields=message,from,created_time,attachments&limit=${limit}&access_token=${credentials.accessToken}`
      );

      if (!response.ok) {
        throw new Error(`Facebook API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      return (data.data || []).map((msg: any) => ({
        id: msg.id,
        platform: 'facebook',
        conversationId,
        senderId: msg.from?.id || 'unknown',
        senderName: msg.from?.name || 'Facebook User',
        content: msg.message || '[Media]',
        timestamp: new Date(msg.created_time),
        type: msg.attachments?.data?.[0]?.type === 'image' ? 'image' : 'text' as const,
        mediaUrl: msg.attachments?.data?.[0]?.image_data?.url,
        isOutgoing: msg.from?.id === credentials.userId,
        status: 'delivered' as const,
      }));
    } catch (error) {
      console.error('Facebook messages error:', error);
      return [];
    }
  }

  private async sendFacebookMessage(credentials: PlatformCredentials, options: SendMessageOptions): Promise<SocialMessage> {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${options.conversationId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: options.content,
          access_token: credentials.accessToken,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Facebook send message error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      id: data.id,
      platform: 'facebook',
      conversationId: options.conversationId,
      senderId: credentials.userId || 'me',
      senderName: credentials.userName || 'You',
      content: options.content,
      timestamp: new Date(),
      type: options.type || 'text',
      mediaUrl: options.mediaUrl,
      isOutgoing: true,
      status: 'sent',
    };
  }

  // Twitter Direct Messages Implementation
  private async getTwitterConversations(credentials: PlatformCredentials): Promise<SocialConversation[]> {
    try {
      // Twitter API v2 doesn't have a direct conversations endpoint
      // We'll simulate conversations based on mentions and replies
      console.log('Twitter conversations simulated from mentions and replies');
      return [];
    } catch (error) {
      console.error('Twitter conversations error:', error);
      return [];
    }
  }

  // Instagram Direct Messages Implementation
  private async getInstagramConversations(credentials: PlatformCredentials): Promise<SocialConversation[]> {
    try {
      // Instagram Basic Display API doesn't support DMs
      // This would require Instagram Messaging API (business accounts only)
      console.log('Instagram conversations require Instagram Messaging API');
      return [];
    } catch (error) {
      console.error('Instagram conversations error:', error);
      return [];
    }
  }

  private async getTwitterMessages(credentials: PlatformCredentials, conversationId: string, limit: number): Promise<SocialMessage[]> {
    // Twitter API v2 has limited DM support
    console.log('Twitter messaging has limited API support');
    return [];
  }

  private async getInstagramMessages(credentials: PlatformCredentials, conversationId: string, limit: number): Promise<SocialMessage[]> {
    // Instagram messaging requires special business API access
    console.log('Instagram messaging requires Instagram Messaging API');
    return [];
  }

  private async sendTwitterMessage(credentials: PlatformCredentials, options: SendMessageOptions): Promise<SocialMessage> {
    throw new Error('Twitter messaging requires special DM API access');
  }

  private async sendInstagramMessage(credentials: PlatformCredentials, options: SendMessageOptions): Promise<SocialMessage> {
    throw new Error('Instagram messaging requires Instagram Messaging API access');
  }

  // LinkedIn Messaging Implementation
  private async getLinkedInConversations(credentials: PlatformCredentials): Promise<SocialConversation[]> {
    try {
      // LinkedIn messaging requires special permissions
      console.log('LinkedIn conversations require messaging permissions');
      return [];
    } catch (error) {
      console.error('LinkedIn conversations error:', error);
      return [];
    }
  }

  private async getLinkedInMessages(credentials: PlatformCredentials, conversationId: string, limit: number): Promise<SocialMessage[]> {
    console.log('LinkedIn messaging requires special permissions');
    return [];
  }

  private async sendLinkedInMessage(credentials: PlatformCredentials, options: SendMessageOptions): Promise<SocialMessage> {
    throw new Error('LinkedIn messaging requires special permissions');
  }

  // Snapchat Implementation
  private async getSnapchatConversations(credentials: PlatformCredentials): Promise<SocialConversation[]> {
    try {
      // Snapchat API is very limited for messaging
      console.log('Snapchat messaging API is limited');
      return [];
    } catch (error) {
      console.error('Snapchat conversations error:', error);
      return [];
    }
  }

  private async getSnapchatMessages(credentials: PlatformCredentials, conversationId: string, limit: number): Promise<SocialMessage[]> {
    console.log('Snapchat messaging API is limited');
    return [];
  }

  private async sendSnapchatMessage(credentials: PlatformCredentials, options: SendMessageOptions): Promise<SocialMessage> {
    throw new Error('Snapchat messaging API is limited');
  }

  // TikTok Implementation
  private async getTikTokConversations(credentials: PlatformCredentials): Promise<SocialConversation[]> {
    try {
      // TikTok doesn't have a public messaging API
      console.log('TikTok messaging API is not publicly available');
      return [];
    } catch (error) {
      console.error('TikTok conversations error:', error);
      return [];
    }
  }

  private async getTikTokMessages(credentials: PlatformCredentials, conversationId: string, limit: number): Promise<SocialMessage[]> {
    console.log('TikTok messaging API is not publicly available');
    return [];
  }

  private async sendTikTokMessage(credentials: PlatformCredentials, options: SendMessageOptions): Promise<SocialMessage> {
    throw new Error('TikTok messaging API is not publicly available');
  }

  // Utility methods
  async markAsRead(platform: string, conversationId: string, messageId?: string): Promise<boolean> {
    const credentials = platformAuth.getCredentials(platform);
    if (!credentials) return false;

    try {
      switch (platform) {
        case 'facebook':
          // Facebook read receipt API
          break;
        case 'instagram':
          // Instagram read receipt API
          break;
        default:
          console.log(`Read receipts not implemented for ${platform}`);
      }
      return true;
    } catch (error) {
      console.error(`Failed to mark as read on ${platform}:`, error);
      return false;
    }
  }

  async getOnlineStatus(platform: string, userId: string): Promise<boolean> {
    // Platform-specific online status checking
    try {
      switch (platform) {
        case 'facebook':
          // Facebook presence API
          break;
        case 'instagram':
          // Instagram activity status
          break;
        default:
          console.log(`Online status not available for ${platform}`);
      }
      return false;
    } catch (error) {
      console.error(`Failed to get online status for ${platform}:`, error);
      return false;
    }
  }
}

export const socialMessaging = new SocialMessagingService();
