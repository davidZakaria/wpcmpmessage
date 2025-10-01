// Content Fetching Service
// Fetches real content from connected social media platforms

import { platformAuth, PlatformCredentials } from './platformAuth';

export interface SocialContent {
  id: string;
  platform: string;
  content: string;
  author: {
    id: string;
    name: string;
    username?: string;
    profileUrl?: string;
  };
  timestamp: Date;
  engagement: {
    likes?: number;
    shares?: number;
    comments?: number;
    views?: number;
  };
  mediaUrls?: string[];
  postUrl?: string;
  contentType: 'text' | 'image' | 'video' | 'link';
  rawData?: any; // Store original platform data
  replies?: SocialReply[]; // Replies to this content
}

export interface SocialReply {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    username?: string;
    profileUrl?: string;
    verified?: boolean;
  };
  timestamp: Date;
  engagement: {
    likes?: number;
    replies?: number;
    retweets?: number;
  };
  rawData?: any;
}

export interface ContentFetchOptions {
  limit?: number;
  since?: Date;
  until?: Date;
  includeMedia?: boolean;
  contentTypes?: string[];
}

class ContentFetcherService {
  // Fetch content from all connected platforms
  async fetchAllContent(options: ContentFetchOptions = {}): Promise<SocialContent[]> {
    const connectedPlatforms = platformAuth.getConnectedPlatforms();
    const allContent: SocialContent[] = [];

    for (const platform of connectedPlatforms) {
      try {
        const content = await this.fetchPlatformContent(platform, options);
        allContent.push(...content);
      } catch (error) {
        if (error instanceof Error && error.message.includes('rate limit')) {
          console.warn(`⏰ ${platform} rate limit reached - this is normal and will reset automatically`);
        } else {
          console.error(`Failed to fetch content from ${platform}:`, error);
        }
      }
    }

    // Sort by timestamp (newest first)
    return allContent.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Fetch content from specific platform
  async fetchPlatformContent(platform: string, options: ContentFetchOptions = {}): Promise<SocialContent[]> {
    const credentials = platformAuth.getCredentials(platform);
    if (!credentials) {
      throw new Error(`Platform ${platform} is not connected`);
    }

    switch (platform) {
      case 'facebook':
        return this.fetchFacebookContent(credentials, options);
      case 'instagram':
        return this.fetchInstagramContent(credentials, options);
      case 'twitter':
        return this.fetchTwitterContent(credentials, options);
      case 'linkedin':
        return this.fetchLinkedInContent(credentials, options);
      case 'youtube':
        return this.fetchYouTubeContent(credentials, options);
      case 'tiktok':
        return this.fetchTikTokContent(credentials, options);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  // Facebook content fetching
  private async fetchFacebookContent(credentials: PlatformCredentials, options: ContentFetchOptions): Promise<SocialContent[]> {
    const limit = options.limit || 25;
    const fields = 'id,message,story,created_time,from,likes.summary(true),shares,comments.summary(true),attachments{media,url}';
    
    // First get user's pages
    const pagesResponse = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${credentials.accessToken}`);
    const pagesData = await pagesResponse.json();
    
    if (!pagesResponse.ok) {
      throw new Error(`Facebook API error: ${pagesData.error?.message}`);
    }

    const content: SocialContent[] = [];

    // Fetch posts from each page
    for (const page of pagesData.data || []) {
      try {
        const postsResponse = await fetch(
          `https://graph.facebook.com/v18.0/${page.id}/posts?fields=${fields}&limit=${limit}&access_token=${credentials.accessToken}`
        );
        const postsData = await postsResponse.json();

        if (postsResponse.ok && postsData.data) {
          for (const post of postsData.data) {
            content.push(this.transformFacebookPost(post));
          }
        }
      } catch (error) {
        console.error(`Failed to fetch posts for page ${page.id}:`, error);
      }
    }

    return content;
  }

  // Instagram content fetching
  private async fetchInstagramContent(credentials: PlatformCredentials, options: ContentFetchOptions): Promise<SocialContent[]> {
    const limit = options.limit || 25;
    const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';
    
    const response = await fetch(
      `https://graph.instagram.com/me/media?fields=${fields}&limit=${limit}&access_token=${credentials.accessToken}`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Instagram API error: ${data.error?.message}`);
    }

    return (data.data || []).map((post: any) => this.transformInstagramPost(post));
  }

  // Twitter content fetching (via server-side API to avoid CORS)
  private async fetchTwitterContent(credentials: PlatformCredentials, options: ContentFetchOptions): Promise<SocialContent[]> {
    const limit = options.limit || 25;

    console.log(`📱 Fetching Twitter content via server API for user: ${credentials.userId}`);
    console.log(`🔍 Twitter credentials debug:`, {
      hasUserId: !!credentials.userId,
      hasAccessToken: !!credentials.accessToken,
      hasUserName: !!credentials.userName,
      credentialsKeys: Object.keys(credentials)
    });

    if (!credentials.userId) {
      console.error('❌ Twitter userId not found in credentials. User needs to reconnect Twitter.');
      throw new Error('Twitter userId not found in credentials. Please disconnect and reconnect Twitter.');
    }

    const response = await fetch(
      `http://localhost:3002/api/twitter/content?userId=${credentials.userId}&accessToken=${credentials.accessToken}&limit=${limit}`
    );

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 429 || (data.error && data.error.includes('rate limit'))) {
        console.warn('⏰ Twitter API rate limit reached. This is normal and will reset automatically.');
        throw new Error('Twitter API rate limit exceeded');
      }
      throw new Error(`Twitter content fetch error: ${data.error || data.details}`);
    }

    return (data.data || []).map((tweet: any) => this.transformTwitterPost(tweet, data.includes));
  }

  // LinkedIn content fetching (server-side to avoid CORS)
  private async fetchLinkedInContent(credentials: PlatformCredentials, options: ContentFetchOptions): Promise<SocialContent[]> {
    // Skip LinkedIn if we've had recent failures to prevent spam
    const failureKey = `linkedin_failure_${credentials.userId}`;
    const lastFailure = localStorage.getItem(failureKey);
    if (lastFailure) {
      const failureTime = parseInt(lastFailure);
      const timeSinceFailure = Date.now() - failureTime;
      // Skip for 5 minutes after a failure
      if (timeSinceFailure < 5 * 60 * 1000) {
        console.log(`⏸️ Skipping LinkedIn fetch due to recent failure (${Math.round(timeSinceFailure / 1000)}s ago)`);
        return [];
      }
    }

    console.log(`🔄 Fetching LinkedIn content via server for user: ${credentials.userId}`);
    
    try {
      const response = await fetch(
        `http://localhost:3002/api/linkedin/content?userId=${credentials.userId}&accessToken=${credentials.accessToken}&limit=${options.limit || 25}`
      );

      const data = await response.json();

      if (!response.ok) {
        // Store failure timestamp to prevent repeated attempts
        localStorage.setItem(failureKey, Date.now().toString());
        throw new Error(`LinkedIn API error: ${data.error || data.details || 'Unknown error'}`);
      }

      // Clear failure timestamp on success
      localStorage.removeItem(failureKey);
      return data.posts?.map((post: any) => this.transformLinkedInPost(post)) || [];
    } catch (error) {
      // Store failure timestamp
      localStorage.setItem(failureKey, Date.now().toString());
      throw error;
    }
  }

  // YouTube content fetching
  private async fetchYouTubeContent(credentials: PlatformCredentials, options: ContentFetchOptions): Promise<SocialContent[]> {
    const limit = options.limit || 25;
    
    // First get the channel ID
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&access_token=${credentials.accessToken}`
    );
    const channelData = await channelResponse.json();

    if (!channelResponse.ok) {
      throw new Error(`YouTube API error: ${channelData.error?.message}`);
    }

    const channelId = channelData.items?.[0]?.id;
    if (!channelId) {
      throw new Error('No YouTube channel found');
    }

    // Get videos from the channel
    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=${limit}&order=date&type=video&access_token=${credentials.accessToken}`
    );
    const videosData = await videosResponse.json();

    if (!videosResponse.ok) {
      throw new Error(`YouTube API error: ${videosData.error?.message}`);
    }

    // Get detailed video statistics
    const videoIds = videosData.items?.map((item: any) => item.id.videoId).join(',');
    if (!videoIds) return [];

    const statsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&access_token=${credentials.accessToken}`
    );
    const statsData = await statsResponse.json();

    if (!statsResponse.ok) {
      throw new Error(`YouTube API error: ${statsData.error?.message}`);
    }

    return (statsData.items || []).map((video: any) => this.transformYouTubeVideo(video));
  }

  // Transform Facebook post to SocialContent
  private transformFacebookPost(post: any): SocialContent {
    return {
      id: post.id,
      platform: 'facebook',
      content: post.message || post.story || 'No text content',
      author: {
        id: post.from?.id || 'unknown',
        name: post.from?.name || 'Unknown User'
      },
      timestamp: new Date(post.created_time),
      engagement: {
        likes: post.likes?.summary?.total_count || 0,
        shares: post.shares?.count || 0,
        comments: post.comments?.summary?.total_count || 0
      },
      mediaUrls: post.attachments?.data?.map((att: any) => att.media?.image?.src).filter(Boolean) || [],
      postUrl: `https://facebook.com/${post.id}`,
      contentType: post.attachments?.data?.some((att: any) => att.media?.image) ? 'image' : 'text',
      rawData: post
    };
  }

  // Transform Instagram post to SocialContent
  private transformInstagramPost(post: any): SocialContent {
    return {
      id: post.id,
      platform: 'instagram',
      content: post.caption || 'No caption',
      author: {
        id: 'me', // Instagram Basic Display API doesn't provide author details for own posts
        name: 'Me'
      },
      timestamp: new Date(post.timestamp),
      engagement: {
        likes: post.like_count || 0,
        comments: post.comments_count || 0
      },
      mediaUrls: [post.media_url, post.thumbnail_url].filter(Boolean),
      postUrl: post.permalink,
      contentType: post.media_type?.toLowerCase() === 'video' ? 'video' : 
                  post.media_type?.toLowerCase() === 'image' ? 'image' : 'text',
      rawData: post
    };
  }

  // Transform Twitter post to SocialContent
  private transformTwitterPost(tweet: any, includes: any = {}): SocialContent {
    const author = includes.users?.find((user: any) => user.id === tweet.author_id) || {};
    
    // Transform replies if they exist
    const replies: SocialReply[] = (tweet.replies || []).map((reply: any) => {
      const replyAuthor = includes.users?.find((user: any) => user.id === reply.author_id) || {};
      return {
        id: reply.id,
        content: reply.text || 'No text content',
        author: {
          id: reply.author_id,
          name: replyAuthor.name || 'Unknown User',
          username: replyAuthor.username,
          profileUrl: replyAuthor.profile_image_url,
          verified: replyAuthor.verified || false
        },
        timestamp: new Date(reply.created_at),
        engagement: {
          likes: reply.public_metrics?.like_count || 0,
          replies: reply.public_metrics?.reply_count || 0,
          retweets: reply.public_metrics?.retweet_count || 0
        },
        rawData: reply
      };
    });
    
    return {
      id: tweet.id,
      platform: 'twitter',
      content: tweet.text || 'No text content',
      author: {
        id: tweet.author_id,
        name: author.name || 'Unknown User',
        username: author.username,
        profileUrl: author.profile_image_url
      },
      timestamp: new Date(tweet.created_at),
      engagement: {
        likes: tweet.public_metrics?.like_count || 0,
        shares: tweet.public_metrics?.retweet_count || 0,
        comments: tweet.public_metrics?.reply_count || 0,
        views: tweet.public_metrics?.impression_count || 0
      },
      mediaUrls: includes.media?.map((media: any) => media.url || media.preview_image_url).filter(Boolean) || [],
      postUrl: `https://twitter.com/${author.username}/status/${tweet.id}`,
      contentType: includes.media?.some((media: any) => media.type === 'video') ? 'video' :
                  includes.media?.some((media: any) => media.type === 'photo') ? 'image' : 'text',
      rawData: tweet,
      replies: replies
    };
  }

  // Transform LinkedIn post to SocialContent
  private transformLinkedInPost(post: any): SocialContent {
    // Handle both UGC API and Shares API response formats
    let content = 'No content';
    let authorId = 'unknown';
    let authorName = 'LinkedIn User';
    let timestamp = new Date();
    let postId = post.id || 'unknown';

    // UGC API format
    if (post.specificContent?.['com.linkedin.ugc.ShareContent']) {
      content = post.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary?.text || 'No content';
    }
    // Shares API format
    else if (post.text?.text) {
      content = post.text.text;
    }
    // Alternative content extraction
    else {
      content = post.commentary || post.text || post.message || post.content?.title || 'No content available';
    }

    // Extract author information
    if (post.author) {
      authorId = post.author.replace('urn:li:person:', '');
      authorName = post.authorName || 'LinkedIn User';
    } else if (post.owner) {
      authorId = post.owner.replace('urn:li:person:', '');
    }

    // Extract timestamp - handle both UGC and Shares API formats
    if (post.created?.time) {
      timestamp = new Date(post.created.time);
    } else if (post.createdAt) {
      timestamp = new Date(post.createdAt);
    } else if (post.publishedAt) {
      timestamp = new Date(post.publishedAt);
    } else if (post.created) {
      // Shares API format
      timestamp = new Date(post.created);
    }

    // Clean up post ID
    if (postId.startsWith('urn:li:ugcPost:')) {
      postId = postId.replace('urn:li:ugcPost:', '');
    }

    return {
      id: postId,
      platform: 'linkedin',
      content,
      author: {
        id: authorId,
        name: authorName,
        profileUrl: `https://linkedin.com/in/${authorId}`
      },
      timestamp,
      engagement: {
        likes: post.socialDetail?.totalSocialActivityCounts?.numLikes || 0,
        shares: post.socialDetail?.totalSocialActivityCounts?.numShares || 0,
        comments: post.socialDetail?.totalSocialActivityCounts?.numComments || 0
      },
      mediaUrls: this.extractLinkedInMedia(post),
      postUrl: `https://linkedin.com/feed/update/${postId}`,
      contentType: this.determineLinkedInContentType(post),
      rawData: post
    };
  }

  // Helper method to extract media URLs from LinkedIn posts
  private extractLinkedInMedia(post: any): string[] {
    const mediaUrls: string[] = [];
    
    // Check for media in specificContent
    const shareContent = post.specificContent?.['com.linkedin.ugc.ShareContent'];
    if (shareContent?.media) {
      shareContent.media.forEach((media: any) => {
        if (media.originalUrl) {
          mediaUrls.push(media.originalUrl);
        }
        if (media.thumbnails?.length > 0) {
          mediaUrls.push(media.thumbnails[0].url);
        }
      });
    }

    return mediaUrls;
  }

  // Helper method to determine LinkedIn content type
  private determineLinkedInContentType(post: any): 'text' | 'image' | 'video' | 'link' {
    const shareContent = post.specificContent?.['com.linkedin.ugc.ShareContent'];
    
    if (shareContent?.media?.length > 0) {
      const media = shareContent.media[0];
      if (media.media?.['com.linkedin.digitalmedia.mediaartifact.StillImage']) {
        return 'image';
      }
      if (media.media?.['com.linkedin.digitalmedia.mediaartifact.Video']) {
        return 'video';
      }
    }
    
    if (shareContent?.shareFeatures?.hashtags?.length > 0 || 
        shareContent?.shareFeatures?.mentions?.length > 0) {
      return 'text';
    }

    return 'text';
  }

  // Transform YouTube video to SocialContent
  private transformYouTubeVideo(video: any): SocialContent {
    return {
      id: video.id,
      platform: 'youtube',
      content: video.snippet?.description || video.snippet?.title || 'No description',
      author: {
        id: video.snippet?.channelId || 'unknown',
        name: video.snippet?.channelTitle || 'YouTube Channel'
      },
      timestamp: new Date(video.snippet?.publishedAt || Date.now()),
      engagement: {
        likes: parseInt(video.statistics?.likeCount || '0'),
        shares: 0, // YouTube doesn't provide share count in API
        comments: parseInt(video.statistics?.commentCount || '0'),
        views: parseInt(video.statistics?.viewCount || '0')
      },
      mediaUrls: [
        video.snippet?.thumbnails?.high?.url || 
        video.snippet?.thumbnails?.medium?.url || 
        video.snippet?.thumbnails?.default?.url
      ].filter(Boolean),
      postUrl: `https://youtube.com/watch?v=${video.id}`,
      contentType: 'video',
      rawData: video
    };
  }

  // Search for specific content across platforms
  async searchContent(query: string, platforms?: string[]): Promise<SocialContent[]> {
    const targetPlatforms = platforms || platformAuth.getConnectedPlatforms();
    const allContent: SocialContent[] = [];

    for (const platform of targetPlatforms) {
      try {
        const content = await this.searchPlatformContent(platform, query);
        allContent.push(...content);
      } catch (error) {
        console.error(`Failed to search content on ${platform}:`, error);
      }
    }

    return allContent.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Search content on specific platform
  private async searchPlatformContent(platform: string, query: string): Promise<SocialContent[]> {
    const credentials = platformAuth.getCredentials(platform);
    if (!credentials) return [];

    // Note: Search functionality varies by platform and requires different API endpoints
    // This is a simplified implementation
    switch (platform) {
      case 'twitter':
        return this.searchTwitterContent(credentials, query);
      default:
        // For other platforms, filter existing content
        const content = await this.fetchPlatformContent(platform, { limit: 100 });
        return content.filter(item => 
          item.content.toLowerCase().includes(query.toLowerCase()) ||
          item.author.name.toLowerCase().includes(query.toLowerCase())
        );
    }
  }

  // Search Twitter content
  private async searchTwitterContent(credentials: PlatformCredentials, query: string): Promise<SocialContent[]> {
    const response = await fetch(
      `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=50&expansions=author_id&tweet.fields=created_at,text,public_metrics&user.fields=name,username,profile_image_url`,
      {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Twitter search error: ${data.detail || data.title}`);
    }

    return (data.data || []).map((tweet: any) => this.transformTwitterPost(tweet, data.includes));
  }

  // Get content statistics
  async getContentStats(): Promise<{
    totalPosts: number;
    platformBreakdown: Record<string, number>;
    engagementTotals: {
      likes: number;
      shares: number;
      comments: number;
      views: number;
    };
  }> {
    const allContent = await this.fetchAllContent({ limit: 1000 });
    
    const stats = {
      totalPosts: allContent.length,
      platformBreakdown: {} as Record<string, number>,
      engagementTotals: {
        likes: 0,
        shares: 0,
        comments: 0,
        views: 0
      }
    };

    allContent.forEach(item => {
      // Platform breakdown
      stats.platformBreakdown[item.platform] = (stats.platformBreakdown[item.platform] || 0) + 1;
      
      // Engagement totals
      stats.engagementTotals.likes += item.engagement.likes || 0;
      stats.engagementTotals.shares += item.engagement.shares || 0;
      stats.engagementTotals.comments += item.engagement.comments || 0;
      stats.engagementTotals.views += item.engagement.views || 0;
    });

    return stats;
  }

  // Twitter moderation actions
  async muteTwitterUser(userId: string, targetUserId: string, accessToken: string, targetUsername?: string): Promise<any> {
    try {
      console.log(`🔇 Muting Twitter user ${targetUserId}`);
      
      const response = await fetch('http://localhost:3002/api/twitter/mute-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          targetUserId,
          accessToken,
          targetUsername
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Mute failed: ${data.details || data.error}`);
      }

      console.log(`✅ Successfully muted user ${targetUserId} (${data.message})`);
      return data;
    } catch (error) {
      console.error('Error muting user:', error);
      throw error;
    }
  }

  async blockTwitterUser(userId: string, targetUserId: string, accessToken: string, targetUsername?: string): Promise<any> {
    try {
      console.log(`🚫 Blocking Twitter user ${targetUserId}`);
      
      const response = await fetch('http://localhost:3002/api/twitter/block-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          targetUserId,
          accessToken,
          targetUsername
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Block failed: ${data.details || data.error}`);
      }

      console.log(`✅ Successfully blocked user ${targetUserId} (${data.message})`);
      return data;
    } catch (error) {
      console.error('Error blocking user:', error);
      throw error;
    }
  }

  async hideTwitterReply(tweetId: string, accessToken: string, userId?: string): Promise<boolean> {
    try {
      console.log(`👁️ Hiding Twitter reply ${tweetId}`);
      
      const response = await fetch('http://localhost:3002/api/twitter/hide-reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tweetId,
          accessToken,
          userId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Hide reply failed: ${data.details || data.error}`);
      }

      console.log(`✅ Successfully hid reply ${tweetId} (${data.message})`);
      return data;
    } catch (error) {
      console.error('Error hiding reply:', error);
      throw error;
    }
  }

  // TikTok content fetching
  private async fetchTikTokContent(credentials: PlatformCredentials, options: ContentFetchOptions): Promise<SocialContent[]> {
    const limit = options.limit || 25;
    
    try {
      // TikTok API endpoint for user videos
      const response = await fetch(
        `https://open-api.tiktok.com/video/list/?access_token=${credentials.accessToken}&max_count=${limit}`
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`TikTok API error: ${data.error?.message || 'Unknown error'}`);
      }
      
      if (!data.data || !data.data.videos) {
        console.log('No TikTok videos found');
        return [];
      }
      
      return data.data.videos.map((video: any) => this.transformTikTokVideo(video));
    } catch (error) {
      console.error('TikTok content fetching error:', error);
      // Return empty array instead of throwing to prevent breaking other platforms
      return [];
    }
  }

  // Transform TikTok video to SocialContent
  private transformTikTokVideo(video: any): SocialContent {
    return {
      id: video.id,
      platform: 'tiktok',
      content: video.title || video.description || 'TikTok Video',
      author: {
        id: video.owner?.id || 'unknown',
        name: video.owner?.username || 'TikTok User',
        username: video.owner?.username,
        profileUrl: video.owner?.avatar_url
      },
      timestamp: new Date(video.create_time * 1000), // TikTok uses Unix timestamp
      engagement: {
        likes: video.stats?.like_count || 0,
        shares: video.stats?.share_count || 0,
        comments: video.stats?.comment_count || 0,
        views: video.stats?.view_count || 0
      },
      mediaUrls: video.video?.cover_image_url ? [video.video.cover_image_url] : [],
      postUrl: video.share_url,
      contentType: 'video',
      rawData: video
    };
  }

  // Reply to a Twitter tweet
  async replyToTweet(tweetId: string, replyText: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const credentials = platformAuth.getStoredCredentials('twitter');
      if (!credentials) {
        throw new Error('Twitter not connected. Please connect your Twitter account first.');
      }

      console.log(`📝 Posting reply to tweet ${tweetId}: "${replyText}"`);

      const response = await fetch('http://localhost:3002/api/twitter/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: credentials.userId,
          accessToken: credentials.accessToken,
          tweetId: tweetId,
          replyText: replyText
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to post reply');
      }

      console.log(`✅ Reply posted successfully:`, data.data?.id);
      return { success: true, data: data.data };

    } catch (error) {
      console.error('❌ Error posting Twitter reply:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export const contentFetcher = new ContentFetcherService();
