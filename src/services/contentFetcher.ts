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
        console.error(`Failed to fetch content from ${platform}:`, error);
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

  // Twitter content fetching
  private async fetchTwitterContent(credentials: PlatformCredentials, options: ContentFetchOptions): Promise<SocialContent[]> {
    const limit = options.limit || 25;
    const expansions = 'author_id,attachments.media_keys,referenced_tweets.id';
    const tweetFields = 'created_at,text,public_metrics,context_annotations,attachments';
    const userFields = 'name,username,profile_image_url';
    const mediaFields = 'url,preview_image_url,type';

    const response = await fetch(
      `https://api.twitter.com/2/users/${credentials.userId}/tweets?` +
      `max_results=${limit}&expansions=${expansions}&tweet.fields=${tweetFields}&user.fields=${userFields}&media.fields=${mediaFields}`,
      {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Twitter API error: ${data.detail || data.title}`);
    }

    return (data.data || []).map((tweet: any) => this.transformTwitterPost(tweet, data.includes));
  }

  // LinkedIn content fetching
  private async fetchLinkedInContent(credentials: PlatformCredentials, options: ContentFetchOptions): Promise<SocialContent[]> {
    // LinkedIn API is more complex and requires specific permissions
    // This is a simplified version
    const response = await fetch(
      `https://api.linkedin.com/v2/shares?q=owners&owners=urn:li:person:${credentials.userId}&count=${options.limit || 25}`,
      {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${data.message}`);
    }

    return (data.elements || []).map((post: any) => this.transformLinkedInPost(post));
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
      rawData: tweet
    };
  }

  // Transform LinkedIn post to SocialContent
  private transformLinkedInPost(post: any): SocialContent {
    const content = post.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || 'No content';
    
    return {
      id: post.id,
      platform: 'linkedin',
      content,
      author: {
        id: post.owner || 'unknown',
        name: 'LinkedIn User'
      },
      timestamp: new Date(post.created?.time || Date.now()),
      engagement: {
        likes: 0, // LinkedIn API doesn't provide engagement metrics in basic response
        shares: 0,
        comments: 0
      },
      mediaUrls: [],
      postUrl: `https://linkedin.com/feed/update/${post.id}`,
      contentType: 'text',
      rawData: post
    };
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
}

export const contentFetcher = new ContentFetcherService();
