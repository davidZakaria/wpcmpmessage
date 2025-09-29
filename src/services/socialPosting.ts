// Social Media Posting Service
// Handles posting content across multiple social media platforms

import { platformAuth, PlatformCredentials } from './platformAuth';

export interface PostContent {
  id: string;
  text: string;
  mediaUrls: string[];
  mediaType: 'image' | 'video' | 'mixed' | null;
  platforms: string[];
  scheduledTime?: Date;
  hashtags: string[];
  mentions: string[];
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  createdAt: Date;
  publishedAt?: Date;
  engagement?: {
    likes: number;
    shares: number;
    comments: number;
    views: number;
  };
  platformPostIds?: Record<string, string>; // Maps platform to post ID
  errors?: Record<string, string>; // Maps platform to error message
}

export interface PostOptions {
  text: string;
  mediaUrls?: string[];
  mediaFiles?: File[];
  hashtags?: string[];
  mentions?: string[];
  scheduledTime?: Date;
  platforms: string[];
}

export interface PlatformLimits {
  text: number;
  hashtags: number;
  mentions: number;
  media: number;
  videoSize: number; // MB
  imageSize: number; // MB
}

class SocialPostingService {
  // Platform-specific limits
  private readonly platformLimits: Record<string, PlatformLimits> = {
    facebook: {
      text: 63206,
      hashtags: 30,
      mentions: 50,
      media: 10,
      videoSize: 4000,
      imageSize: 100,
    },
    instagram: {
      text: 2200,
      hashtags: 30,
      mentions: 20,
      media: 10,
      videoSize: 4000,
      imageSize: 100,
    },
    twitter: {
      text: 280,
      hashtags: 10,
      mentions: 10,
      media: 4,
      videoSize: 512,
      imageSize: 5,
    },
    linkedin: {
      text: 3000,
      hashtags: 10,
      mentions: 50,
      media: 9,
      videoSize: 5000,
      imageSize: 100,
    },
    tiktok: {
      text: 300,
      hashtags: 20,
      mentions: 20,
      media: 1,
      videoSize: 4000,
      imageSize: 10,
    },
    snapchat: {
      text: 250,
      hashtags: 10,
      mentions: 10,
      media: 1,
      videoSize: 1000,
      imageSize: 10,
    },
  };

  // Get platform limits
  getPlatformLimits(platform: string): PlatformLimits {
    return this.platformLimits[platform] || this.platformLimits.twitter;
  }

  // Get combined limits for multiple platforms
  getCombinedLimits(platforms: string[]): PlatformLimits {
    if (platforms.length === 0) return this.platformLimits.twitter;

    return {
      text: Math.min(...platforms.map(p => this.getPlatformLimits(p).text)),
      hashtags: Math.min(...platforms.map(p => this.getPlatformLimits(p).hashtags)),
      mentions: Math.min(...platforms.map(p => this.getPlatformLimits(p).mentions)),
      media: Math.min(...platforms.map(p => this.getPlatformLimits(p).media)),
      videoSize: Math.min(...platforms.map(p => this.getPlatformLimits(p).videoSize)),
      imageSize: Math.min(...platforms.map(p => this.getPlatformLimits(p).imageSize)),
    };
  }

  // Validate post content against platform limits
  validatePost(content: PostOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const limits = this.getCombinedLimits(content.platforms);

    // Text length validation
    const fullText = this.buildFullText(content.text, content.hashtags, content.mentions);
    if (fullText.length > limits.text) {
      errors.push(`Text exceeds ${limits.text} character limit (${fullText.length} characters)`);
    }

    // Hashtag validation
    if ((content.hashtags?.length || 0) > limits.hashtags) {
      errors.push(`Too many hashtags (max ${limits.hashtags})`);
    }

    // Mention validation
    if ((content.mentions?.length || 0) > limits.mentions) {
      errors.push(`Too many mentions (max ${limits.mentions})`);
    }

    // Media validation
    if ((content.mediaUrls?.length || 0) > limits.media) {
      errors.push(`Too many media files (max ${limits.media})`);
    }

    // Scheduled time validation
    if (content.scheduledTime && content.scheduledTime <= new Date()) {
      errors.push('Scheduled time must be in the future');
    }

    return { valid: errors.length === 0, errors };
  }

  // Build full text with hashtags and mentions
  private buildFullText(text: string, hashtags?: string[], mentions?: string[]): string {
    let fullText = text;
    
    if (hashtags && hashtags.length > 0) {
      fullText += ' ' + hashtags.map(tag => `#${tag}`).join(' ');
    }
    
    if (mentions && mentions.length > 0) {
      fullText += ' ' + mentions.map(mention => `@${mention}`).join(' ');
    }
    
    return fullText;
  }

  // Publish post to multiple platforms
  async publishPost(options: PostOptions): Promise<PostContent> {
    const validation = this.validatePost(options);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const post: PostContent = {
      id: `post_${Date.now()}`,
      text: options.text,
      mediaUrls: options.mediaUrls || [],
      mediaType: this.determineMediaType(options.mediaUrls),
      platforms: options.platforms,
      scheduledTime: options.scheduledTime,
      hashtags: options.hashtags || [],
      mentions: options.mentions || [],
      status: options.scheduledTime ? 'scheduled' : 'publishing',
      createdAt: new Date(),
      platformPostIds: {},
      errors: {},
    };

    if (options.scheduledTime) {
      // Schedule the post
      await this.schedulePost(post);
      return { ...post, status: 'scheduled' };
    } else {
      // Publish immediately
      return await this.publishToAllPlatforms(post);
    }
  }

  // Publish to all selected platforms
  private async publishToAllPlatforms(post: PostContent): Promise<PostContent> {
    const results = await Promise.allSettled(
      post.platforms.map(platform => this.publishToPlatform(platform, post))
    );

    let hasSuccess = false;
    let hasFailure = false;

    results.forEach((result, index) => {
      const platform = post.platforms[index];
      
      if (result.status === 'fulfilled') {
        post.platformPostIds![platform] = result.value;
        hasSuccess = true;
      } else {
        post.errors![platform] = result.reason.message;
        hasFailure = true;
      }
    });

    post.status = hasSuccess ? (hasFailure ? 'published' : 'published') : 'failed';
    post.publishedAt = hasSuccess ? new Date() : undefined;

    return post;
  }

  // Publish to specific platform
  private async publishToPlatform(platform: string, post: PostContent): Promise<string> {
    const credentials = platformAuth.getCredentials(platform);
    if (!credentials) {
      throw new Error(`Platform ${platform} is not connected`);
    }

    switch (platform) {
      case 'facebook':
        return this.publishToFacebook(credentials, post);
      case 'instagram':
        return this.publishToInstagram(credentials, post);
      case 'twitter':
        return this.publishToTwitter(credentials, post);
      case 'linkedin':
        return this.publishToLinkedIn(credentials, post);
      case 'tiktok':
        return this.publishToTikTok(credentials, post);
      case 'snapchat':
        return this.publishToSnapchat(credentials, post);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  // Facebook posting
  private async publishToFacebook(credentials: PlatformCredentials, post: PostContent): Promise<string> {
    const fullText = this.buildFullText(post.text, post.hashtags, post.mentions);
    
    try {
      let endpoint = `https://graph.facebook.com/v18.0/me/feed`;
      let body: any = {
        message: fullText,
        access_token: credentials.accessToken,
      };

      // Handle media
      if (post.mediaUrls.length > 0) {
        // For media posts, use photos endpoint
        endpoint = `https://graph.facebook.com/v18.0/me/photos`;
        body.url = post.mediaUrls[0]; // Facebook allows one image per post via URL
        body.caption = fullText;
        delete body.message;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Facebook posting failed');
      }

      const data = await response.json();
      return data.id;
    } catch (error) {
      console.error('Facebook posting error:', error);
      throw error;
    }
  }

  // Instagram posting
  private async publishToInstagram(credentials: PlatformCredentials, post: PostContent): Promise<string> {
    try {
      // Instagram Basic Display API doesn't support posting
      // This requires Instagram Content Publishing API (business accounts)
      
      if (post.mediaUrls.length === 0) {
        throw new Error('Instagram requires at least one media file');
      }

      // This is a placeholder - actual implementation would require:
      // 1. Upload media to Instagram
      // 2. Create media container
      // 3. Publish media container
      
      throw new Error('Instagram posting requires Instagram Content Publishing API');
    } catch (error) {
      console.error('Instagram posting error:', error);
      throw error;
    }
  }

  // Twitter posting
  private async publishToTwitter(credentials: PlatformCredentials, post: PostContent): Promise<string> {
    const fullText = this.buildFullText(post.text, post.hashtags, post.mentions);
    
    try {
      console.log(`📝 Attempting to post to Twitter via server endpoint...`);
      
      let mediaIds: string[] = [];
      
      // Step 1: Upload media if provided
      if (post.mediaUrls && post.mediaUrls.length > 0) {
        console.log(`📸 Uploading ${post.mediaUrls.length} media files to Twitter...`);
        
        for (const mediaUrl of post.mediaUrls) {
          try {
            console.log(`📤 Processing media: ${mediaUrl.substring(0, 50)}...`);
            
            // Convert blob URL to base64 for server upload
            const mediaData = await this.convertBlobToBase64(mediaUrl);
            const mediaType = this.getMediaTypeFromUrl(mediaUrl);
            
            console.log(`📊 Media conversion complete:`, {
              originalUrl: mediaUrl.substring(0, 50),
              base64Length: mediaData.length,
              estimatedSize: `${(mediaData.length * 0.75 / 1024 / 1024).toFixed(2)}MB`,
              mediaType: mediaType
            });
            
            const uploadResponse = await fetch('http://localhost:3002/api/twitter/upload-media', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                accessToken: credentials.accessToken,
                mediaData: mediaData,
                mediaType: mediaType,
              }),
            });

            console.log(`📡 Upload response:`, {
              status: uploadResponse.status,
              statusText: uploadResponse.statusText,
              ok: uploadResponse.ok
            });

            if (uploadResponse.ok) {
              const uploadResult = await uploadResponse.json();
              mediaIds.push(uploadResult.mediaId);
              console.log(`✅ Media uploaded successfully: ${uploadResult.mediaId}`);
            } else {
              const errorText = await uploadResponse.text();
              console.error(`❌ Media upload failed for ${mediaUrl}:`, {
                status: uploadResponse.status,
                error: errorText.substring(0, 200)
              });
              
              // Check if it's the OAuth 1.0a authentication issue
              if (uploadResponse.status === 501) {
                console.log(`ℹ️ Twitter media upload requires OAuth 1.0a - not implemented yet`);
                // Don't try other media files if it's an authentication issue
                break;
              }
              
              // Continue with other media files for other types of errors
            }
          } catch (mediaError) {
            console.error(`❌ Error processing media ${mediaUrl}:`, mediaError);
            // Continue with other media files
          }
        }
        
        if (mediaIds.length === 0 && post.mediaUrls.length > 0) {
          console.warn(`⚠️ All media uploads failed, posting text only`);
        }
      }
      
      // Step 2: Post tweet with media IDs
      const response = await fetch('http://localhost:3002/api/twitter/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: credentials.userId,
          accessToken: credentials.accessToken,
          text: fullText,
          mediaIds: mediaIds,
        }),
      });

      // Handle different response types
      let data;
      const responseText = await response.text();
      
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse Twitter API response:', responseText.substring(0, 200));
        throw new Error(`Server returned invalid response: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        console.error('Twitter posting failed:', data);
        throw new Error(data.details || data.error || 'Twitter posting failed');
      }

      console.log('✅ Twitter post successful:', data);
      return data.tweetId || data.id || 'unknown';
    } catch (error: any) {
      console.error('Twitter posting error:', error);
      
      // Provide more helpful error messages
      if (error.message?.includes('404')) {
        throw new Error('Twitter posting endpoint not available. Please restart the server.');
      } else if (error.message?.includes('403')) {
        throw new Error('Twitter posting permission denied. Please reconnect Twitter with posting permissions.');
      } else if (error.message?.includes('429')) {
        throw new Error('Twitter rate limit exceeded. Please try again later.');
      }
      
      throw error;
    }
  }

  // LinkedIn posting
  private async publishToLinkedIn(credentials: PlatformCredentials, post: PostContent): Promise<string> {
    const fullText = this.buildFullText(post.text, post.hashtags, post.mentions);
    
    try {
      console.log(`📝 Attempting to post to LinkedIn via server endpoint...`);
      
      // Use server-side endpoint for LinkedIn posting
      const response = await fetch('http://localhost:3002/api/linkedin/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: credentials.userId,
          accessToken: credentials.accessToken,
          text: fullText,
          mediaUrls: post.mediaUrls,
        }),
      });

      // Handle different response types
      let data;
      const responseText = await response.text();
      
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse LinkedIn API response:', responseText.substring(0, 200));
        throw new Error(`Server returned invalid response: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        console.error('LinkedIn posting failed:', data);
        throw new Error(data.details || data.error || 'LinkedIn posting failed');
      }

      console.log('✅ LinkedIn post successful:', data);
      return data.postId || data.id || 'unknown';
    } catch (error: any) {
      console.error('LinkedIn posting error:', error);
      
      // Provide more helpful error messages
      if (error.message?.includes('404')) {
        throw new Error('LinkedIn posting endpoint not available. Please restart the server.');
      } else if (error.message?.includes('403') || error.message?.includes('permissions') || error.message?.includes('shares.CREATE')) {
        throw new Error('LinkedIn posting not available. Your app needs "Share on LinkedIn" product approval from LinkedIn. For now, you can copy your content and post manually on LinkedIn.');
      } else if (error.message?.includes('429')) {
        throw new Error('LinkedIn rate limit exceeded. Please try again later.');
      }
      
      throw error;
    }
  }

  // TikTok posting
  private async publishToTikTok(credentials: PlatformCredentials, post: PostContent): Promise<string> {
    try {
      console.log(`📝 Attempting to post to TikTok...`);
      
      // TikTok API requires video content for posting
      if (post.mediaUrls.length === 0) {
        throw new Error('TikTok requires video content for posting. Please upload a video file.');
      }

      // For now, TikTok posting is limited due to API restrictions
      // This would require TikTok for Business API access
      throw new Error('TikTok posting requires TikTok for Business API access. Please use the TikTok mobile app to post content manually.');
    } catch (error) {
      console.error('TikTok posting error:', error);
      throw error;
    }
  }

  // Snapchat posting
  private async publishToSnapchat(credentials: PlatformCredentials, post: PostContent): Promise<string> {
    try {
      // Snapchat API is limited and mainly for ads
      throw new Error('Snapchat posting API is limited');
    } catch (error) {
      console.error('Snapchat posting error:', error);
      throw error;
    }
  }

  // Schedule post for later
  private async schedulePost(post: PostContent): Promise<void> {
    try {
      console.log(`📅 Scheduling post for ${post.scheduledTime?.toISOString()}`);
      
      // Get credentials for all platforms
      const credentials: Record<string, any> = {};
      for (const platform of post.platforms) {
        const platformCredentials = platformAuth.getCredentials(platform);
        if (platformCredentials) {
          credentials[platform] = platformCredentials;
        }
      }
      
      const response = await fetch('http://localhost:3002/api/posts/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'demo_user', // You'll need to get the actual user ID
          content: post.text,
          platforms: post.platforms,
          mediaUrls: post.mediaUrls,
          hashtags: post.hashtags,
          mentions: post.mentions,
          scheduledTime: post.scheduledTime?.toISOString(),
          credentials: credentials
        }),
      }).catch(error => {
        console.error('❌ Network error when scheduling post:', error);
        throw new Error('Server is not running. Please start the server with: npm run server');
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to schedule post');
      }

      const result = await response.json();
      console.log(`✅ Post scheduled successfully:`, result);
      
    } catch (error) {
      console.error('❌ Error scheduling post:', error);
      throw error;
    }
  }

  // Get post analytics
  async getPostAnalytics(postId: string, platform: string): Promise<any> {
    const credentials = platformAuth.getCredentials(platform);
    if (!credentials) {
      throw new Error(`Platform ${platform} is not connected`);
    }

    try {
      switch (platform) {
        case 'facebook':
          return this.getFacebookAnalytics(credentials, postId);
        case 'instagram':
          return this.getInstagramAnalytics(credentials, postId);
        case 'twitter':
          return this.getTwitterAnalytics(credentials, postId);
        case 'linkedin':
          return this.getLinkedInAnalytics(credentials, postId);
        default:
          throw new Error(`Analytics not available for ${platform}`);
      }
    } catch (error) {
      console.error(`Failed to get analytics for ${platform}:`, error);
      return null;
    }
  }

  private async getFacebookAnalytics(credentials: PlatformCredentials, postId: string): Promise<any> {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${postId}?fields=likes.summary(true),shares,comments.summary(true),reactions.summary(true)&access_token=${credentials.accessToken}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch Facebook analytics');
    }

    return response.json();
  }

  private async getInstagramAnalytics(credentials: PlatformCredentials, postId: string): Promise<any> {
    // Instagram analytics require Instagram Business API
    throw new Error('Instagram analytics require business API access');
  }

  private async getTwitterAnalytics(credentials: PlatformCredentials, postId: string): Promise<any> {
    // Twitter analytics via server-side endpoint
    const response = await fetch(
      `http://localhost:3002/api/twitter/analytics/${postId}?accessToken=${credentials.accessToken}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch Twitter analytics');
    }

    return response.json();
  }

  private async getLinkedInAnalytics(credentials: PlatformCredentials, postId: string): Promise<any> {
    // LinkedIn analytics via server-side endpoint
    const response = await fetch(
      `http://localhost:3002/api/linkedin/analytics/${postId}?accessToken=${credentials.accessToken}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch LinkedIn analytics');
    }

    return response.json();
  }

  // Helper methods for media processing
  private async convertBlobToBase64(blobUrl: string): Promise<string> {
    try {
      const response = await fetch(blobUrl);
      const blob = await response.blob();
      
      // Check file size and compress if needed
      const maxSize = 5 * 1024 * 1024; // 5MB limit for Twitter
      let processedBlob = blob;
      
      if (blob.size > maxSize && blob.type.startsWith('image/')) {
        console.log(`📦 Compressing image: ${(blob.size / 1024 / 1024).toFixed(2)}MB → target: <5MB`);
        processedBlob = await this.compressImage(blob, maxSize);
        console.log(`✅ Compressed to: ${(processedBlob.size / 1024 / 1024).toFixed(2)}MB`);
      }
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1]; // Remove data:image/jpeg;base64, prefix
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(processedBlob);
      });
    } catch (error) {
      console.error('Error converting blob to base64:', error);
      throw error;
    }
  }

  // Compress image to reduce file size
  private async compressImage(blob: Blob, maxSize: number): Promise<Blob> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions to reduce file size
        let { width, height } = img;
        const maxDimension = 1920; // Max width/height
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          } else {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        // Try different quality levels until under size limit
        let quality = 0.8;
        const tryCompress = () => {
          canvas.toBlob((compressedBlob) => {
            if (compressedBlob && (compressedBlob.size <= maxSize || quality <= 0.1)) {
              resolve(compressedBlob);
            } else {
              quality -= 0.1;
              tryCompress();
            }
          }, 'image/jpeg', quality);
        };
        
        tryCompress();
      };
      
      img.src = URL.createObjectURL(blob);
    });
  }

  private getMediaTypeFromUrl(url: string): string {
    if (url.includes('image/')) return 'image/jpeg';
    if (url.includes('video/')) return 'video/mp4';
    if (url.toLowerCase().includes('.png')) return 'image/png';
    if (url.toLowerCase().includes('.gif')) return 'image/gif';
    if (url.toLowerCase().includes('.mp4')) return 'video/mp4';
    if (url.toLowerCase().includes('.mov')) return 'video/quicktime';
    return 'image/jpeg'; // Default
  }

  // Utility methods
  private determineMediaType(mediaUrls?: string[]): 'image' | 'video' | 'mixed' | null {
    if (!mediaUrls || mediaUrls.length === 0) return null;
    
    const hasImages = mediaUrls.some(url => /\.(jpg|jpeg|png|gif|webp)$/i.test(url));
    const hasVideos = mediaUrls.some(url => /\.(mp4|mov|avi|webm)$/i.test(url));
    
    if (hasImages && hasVideos) return 'mixed';
    if (hasVideos) return 'video';
    if (hasImages) return 'image';
    return null;
  }

  // Delete post from platform
  async deletePost(platform: string, postId: string): Promise<boolean> {
    const credentials = platformAuth.getCredentials(platform);
    if (!credentials) return false;

    try {
      switch (platform) {
        case 'facebook':
          await this.deleteFacebookPost(credentials, postId);
          break;
        case 'twitter':
          await this.deleteTwitterPost(credentials, postId);
          break;
        case 'linkedin':
          await this.deleteLinkedInPost(credentials, postId);
          break;
        default:
          throw new Error(`Delete not supported for ${platform}`);
      }
      return true;
    } catch (error) {
      console.error(`Failed to delete post from ${platform}:`, error);
      return false;
    }
  }

  private async deleteFacebookPost(credentials: PlatformCredentials, postId: string): Promise<void> {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${postId}?access_token=${credentials.accessToken}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      throw new Error('Failed to delete Facebook post');
    }
  }

  private async deleteTwitterPost(credentials: PlatformCredentials, postId: string): Promise<void> {
    const response = await fetch(
      `http://localhost:3002/api/twitter/delete/${postId}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: credentials.userId,
          accessToken: credentials.accessToken,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete Twitter post');
    }
  }

  private async deleteLinkedInPost(credentials: PlatformCredentials, postId: string): Promise<void> {
    const response = await fetch(
      `http://localhost:3002/api/linkedin/delete/${postId}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: credentials.userId,
          accessToken: credentials.accessToken,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete LinkedIn post');
    }
  }
}

export const socialPosting = new SocialPostingService();
