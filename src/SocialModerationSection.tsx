import React, { useState, useEffect, useCallback } from 'react';
import { platformAuth } from './services/platformAuth';
import { contentFetcher, SocialContent } from './services/contentFetcher';
import { aiModerationService, AIAnalysisResult, ModerationContext } from './services/aiModerationService';
import { exportService, ExportOptions } from './services/exportService';
// import { websocketService, useWebSocket } from './services/websocketService'; // Disabled - no WebSocket server
import SocialChatTab from './components/SocialChatTab';
import SocialPostingTab from './components/SocialPostingTab';
// import RealTimeDashboard from './components/RealTimeDashboard'; // Disabled - uses WebSocket
import { useLiveSocialContent, useLiveAnalytics } from './hooks/useLiveData';
import { LiveIndicator } from './components/LiveIndicator';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  Card,
  CardBody,
  CardHeader,
  Badge,
  Input,
  Select,
  Textarea,
  Switch,
  FormControl,
  FormLabel,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Progress,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  useToast,
  useColorModeValue,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Grid,
  GridItem,
  Icon,
  Flex,
  Spacer,
  Divider,
  Tag,
  TagLabel,
  TagCloseButton,
  Wrap,
  WrapItem,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Tooltip,
  SimpleGrid,
} from '@chakra-ui/react';
import {
  FaShieldAlt,
  FaEye,
  FaRobot,
  FaUsers,
  FaChartLine,
  FaCog,
  FaCloud,
  FaExclamationTriangle,
  FaBan,
  FaCheck,
  FaClock,
  FaFilter,
  FaSearch,
  FaDownload,
  FaUpload,
  FaPlay,
  FaPause,
  FaStop,
  FaSyncAlt,
  FaGlobe,
  FaFacebook,
  FaTwitter,
  FaInstagram,
  FaYoutube,
  FaTiktok,
  FaLinkedin,
  FaEyeSlash,
  FaVolumeMute,
  FaComments,
  FaSync,
  FaPaperPlane,
  FaEdit,
  FaSnapchat,
  FaReply,
} from 'react-icons/fa';

interface ContentItem {
  id: string;
  platform: string;
  content: string;
  author: string;
  timestamp: Date;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  aiConfidence: number;
  aiAnalysis?: AIAnalysisResult;
  sentiment?: 'positive' | 'negative' | 'neutral';
  toxicity?: number;
  brandSafety?: number;
}

interface ModerationRule {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  keywords: string[];
  action: 'flag' | 'block' | 'review' | 'auto-approve';
}

interface Platform {
  id: string;
  name: string;
  icon: any;
  enabled: boolean;
  connected: boolean;
  lastSync: Date;
  itemsProcessed: number;
  connecting?: boolean;
  userName?: string;
  userId?: string;
}

const SocialModerationSection: React.FC = () => {
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [moderationRules, setModerationRules] = useState<ModerationRule[]>([]);
  
  // WebSocket integration
  // const { connectionStatus, lastMessage } = useWebSocket(); // Disabled - no WebSocket server
  const [platforms, setPlatforms] = useState<Platform[]>([
    { id: 'facebook', name: 'Facebook', icon: FaFacebook, enabled: true, connected: false, lastSync: new Date(), itemsProcessed: 0 },
    { id: 'twitter', name: 'Twitter', icon: FaTwitter, enabled: true, connected: false, lastSync: new Date(), itemsProcessed: 0 },
    { id: 'instagram', name: 'Instagram', icon: FaInstagram, enabled: true, connected: false, lastSync: new Date(), itemsProcessed: 0 },
    { id: 'youtube', name: 'YouTube', icon: FaYoutube, enabled: true, connected: false, lastSync: new Date(), itemsProcessed: 0 },
    { id: 'tiktok', name: 'TikTok', icon: FaTiktok, enabled: true, connected: false, lastSync: new Date(), itemsProcessed: 0 },
    { id: 'linkedin', name: 'LinkedIn', icon: FaLinkedin, enabled: true, connected: false, lastSync: new Date(), itemsProcessed: 0 },
    { id: 'snapchat', name: 'Snapchat', icon: FaSnapchat, enabled: true, connected: false, lastSync: new Date(), itemsProcessed: 0 },
  ]);
  
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSentiment, setFilterSentiment] = useState('all');
  const [filterToxicity, setFilterToxicity] = useState('all');
  const [filterBrandSafety, setFilterBrandSafety] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [savedFilters, setSavedFilters] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [newRule, setNewRule] = useState<Partial<ModerationRule>>({});
  
  const { isOpen: isContentModalOpen, onOpen: onContentModalOpen, onClose: onContentModalClose } = useDisclosure();
  const { isOpen: isRuleModalOpen, onOpen: onRuleModalOpen, onClose: onRuleModalClose } = useDisclosure();
  const toast = useToast();
  
  // Reply functionality state
  const [replyText, setReplyText] = useState('');
  const [replyingToTweet, setReplyingToTweet] = useState<string | null>(null);
  const [isPostingReply, setIsPostingReply] = useState(false);
  
  // AI service status
  const [aiAvailable, setAiAvailable] = useState(true);
  const [showQuotaWarning, setShowQuotaWarning] = useState(false);
  
  // Real content state
  // Live data hooks disabled to prevent crashes
  // const liveContent = useLiveSocialContent();
  // const liveAnalytics = useLiveAnalytics();
  
  // Mock live data objects to prevent errors
  const liveContent = {
    data: [],
    isLoading: false,
    error: null,
    lastUpdated: null,
    isLive: false,
    refresh: () => Promise.resolve(),
    toggleLive: () => {},
    setUpdateInterval: () => {}
  };
  
  const liveAnalytics = {
    data: null,
    isLoading: false,
    error: null,
    lastUpdated: null,
    isLive: false,
    refresh: () => Promise.resolve(),
    toggleLive: () => {},
    setUpdateInterval: () => {}
  };
  
  const [realContent, setRealContent] = useState<SocialContent[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentStats, setContentStats] = useState({
    totalPosts: 0,
    flaggedContent: 0,
    platformBreakdown: {} as Record<string, number>,
    engagementTotals: {
      likes: 0,
      shares: 0,
      comments: 0,
      views: 0
    }
  });

  // Live content sync disabled to prevent crashes
  // useEffect(() => {
  //   if (liveContent.data) {
  //     setRealContent(liveContent.data);
  //     
  //     // Update content stats
  //     const stats = {
  //       totalPosts: liveContent.data.length,
  //       flaggedContent: liveContent.data.filter(item => 
  //         item.sentiment === 'negative' || 
  //         (item.engagement && item.engagement.likes < 5)
  //       ).length,
  //       platformBreakdown: liveContent.data.reduce((acc, item) => {
  //         acc[item.platform] = (acc[item.platform] || 0) + 1;
  //         return acc;
  //       }, {} as Record<string, number>),
  //       engagementTotals: liveContent.data.reduce((acc, item) => {
  //         if (item.engagement) {
  //           acc.likes += item.engagement.likes || 0;
  //           acc.shares += item.engagement.shares || 0;
  //           acc.comments += item.engagement.comments || 0;
  //           acc.views += item.engagement.views || 0;
  //         }
  //         return acc;
  //       }, { likes: 0, shares: 0, comments: 0, views: 0 })
  //     };
  //     
  //     setContentStats(stats);
  //   }
  // }, [liveContent.data]);

  // Check platform connections on mount
  useEffect(() => {
    checkPlatformConnections();
    // Don't call loadRealContent() here - live data hook handles it
  }, []);

  // Debounced platform connection check to avoid excessive calls
  const debouncedCheckConnections = useCallback(() => {
    const timeoutId = setTimeout(() => {
      checkPlatformConnections();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, []);

  // Check which platforms are connected
  const checkPlatformConnections = () => {
    setPlatforms(prev => prev.map(platform => {
      const isConnected = platformAuth.isConnected(platform.id);
      const credentials = platformAuth.getCredentials(platform.id);
      
      return {
        ...platform,
        connected: isConnected,
        userName: credentials?.userName,
        userId: credentials?.userId
      };
    }));
  };

  // Load real content from connected platforms
  const loadRealContent = async () => {
    setIsLoadingContent(true);
    try {
      console.log('🔍 Loading content from connected platforms...');
      
      // Check which platforms are connected
      const connectedPlatforms = platformAuth.getConnectedPlatforms();
      console.log('🔗 Connected platforms:', connectedPlatforms);
      
      // Check Twitter credentials specifically
      const twitterCredentials = platformAuth.getCredentials('twitter');
      console.log('🐦 Twitter credentials:', {
        hasCredentials: !!twitterCredentials,
        userId: twitterCredentials?.userId,
        userName: twitterCredentials?.userName,
        hasAccessToken: !!twitterCredentials?.accessToken
      });
      
      const content = await contentFetcher.fetchAllContent({ limit: 50 });
      console.log('📱 Fetched content:', {
        totalItems: content.length,
        platforms: [...new Set(content.map(item => item.platform))],
        twitterItems: content.filter(item => item.platform === 'twitter').length
      });
      
      setRealContent(content);
      
      // Update platform stats and real analytics
      const stats = await contentFetcher.getContentStats();
      setPlatforms(prev => prev.map(platform => ({
        ...platform,
        itemsProcessed: stats.platformBreakdown[platform.id] || 0
      })));
      
      // Calculate real content statistics
      const totalReplies = content.reduce((sum, item) => sum + (item.replies?.length || 0), 0);
      const flaggedReplies = content.reduce((sum, item) => {
        const replies = item.replies || [];
        // Simple AI flagging based on content analysis
        const flagged = replies.filter(reply => 
          reply.content.toLowerCase().includes('spam') ||
          reply.content.toLowerCase().includes('hate') ||
          reply.content.toLowerCase().includes('scam') ||
          reply.content.length > 500 || // Very long replies might be spam
          /(.)\1{4,}/.test(reply.content) // Repeated characters
        );
        return sum + flagged.length;
      }, 0);
      
      setContentStats({
        totalPosts: content.length,
        flaggedContent: flaggedReplies,
        platformBreakdown: stats.platformBreakdown,
        engagementTotals: stats.engagementTotals
      });
      
      toast({
        title: 'Content Loaded',
        description: `Loaded ${content.length} posts from connected platforms (${content.filter(item => item.platform === 'twitter').length} from Twitter)`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Failed to load real content:', error);
      
      let title = 'Content Load Failed';
      let description = `Failed to load content from platforms: ${error.message}`;
      let status: 'error' | 'warning' = 'error';
      let duration = 5000;
      
      // Handle rate limiting specifically
      if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
        title = '⏰ Twitter Rate Limited';
        description = 'Twitter API rate limit exceeded. Please wait 10-15 minutes before trying again. Your connection is working - just need to wait for the rate limit to reset.';
        status = 'warning';
        duration = 10000;
      }
      
      toast({
        title,
        description,
        status,
        duration,
        isClosable: true,
      });
    } finally {
      setIsLoadingContent(false);
    }
  };

  // Connect to platform
  const connectPlatform = async (platformId: string) => {
    try {
      setPlatforms(prev => prev.map(p => 
        p.id === platformId ? { ...p, connecting: true } : p
      ));

      const authUrl = await platformAuth.generateAuthUrl(platformId);
      
      // Open popup window for OAuth
      const popup = window.open(
        authUrl,
        'oauth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      // Listen for OAuth callback
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          // Check if connection was successful
          setTimeout(() => {
            checkPlatformConnections();
            if (platformAuth.isConnected(platformId)) {
              toast({
                title: 'Platform Connected',
                description: `Successfully connected to ${platforms.find(p => p.id === platformId)?.name}`,
                status: 'success',
                duration: 3000,
                isClosable: true,
              });
              loadRealContent();
            }
          }, 1000);
        }
      }, 1000);

    } catch (error) {
      console.error(`Failed to connect to ${platformId}:`, error);
      toast({
        title: 'Connection Failed',
        description: `Failed to connect to ${platforms.find(p => p.id === platformId)?.name}`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setPlatforms(prev => prev.map(p => 
        p.id === platformId ? { ...p, connecting: false } : p
      ));
    }
  };

  // Disconnect from platform
  const disconnectPlatform = (platformId: string) => {
    platformAuth.disconnect(platformId);
    checkPlatformConnections();
    loadRealContent();
    
    toast({
      title: 'Platform Disconnected',
      description: `Disconnected from ${platforms.find(p => p.id === platformId)?.name}`,
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };

  // Test platform connection
  const testPlatformConnection = async (platformId: string) => {
    try {
      const isWorking = await platformAuth.testConnection(platformId);
      toast({
        title: isWorking ? 'Connection Working' : 'Connection Failed',
        description: isWorking 
          ? `${platforms.find(p => p.id === platformId)?.name} connection is working properly`
          : `${platforms.find(p => p.id === platformId)?.name} connection has issues`,
        status: isWorking ? 'success' : 'error',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error(`Connection test failed for ${platformId}:`, error);
      toast({
        title: 'Connection Test Failed',
        description: `Could not test connection to ${platforms.find(p => p.id === platformId)?.name}`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Reply to Twitter tweet
  const handleReplyToTweet = async (tweetId: string) => {
    if (!replyText.trim()) {
      toast({
        title: 'Reply Required',
        description: 'Please enter a reply message.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsPostingReply(true);
    try {
      const result = await contentFetcher.replyToTweet(tweetId, replyText);
      
      if (result.success) {
        toast({
          title: 'Reply Posted',
          description: 'Your reply has been posted successfully!',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Clear reply state
        setReplyText('');
        setReplyingToTweet(null);
        
        // Refresh content to show the new reply
        await loadRealContent();
      } else {
        throw new Error(result.error || 'Failed to post reply');
      }
    } catch (error) {
      console.error('❌ Failed to post reply:', error);
      toast({
        title: 'Reply Failed',
        description: error instanceof Error ? error.message : 'Failed to post reply',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsPostingReply(false);
    }
  };

  // Load moderation rules from localStorage
  const loadModerationRules = (): ModerationRule[] => {
    try {
      const savedRules = localStorage.getItem('moderationRules');
      if (savedRules) {
        const parsedRules = JSON.parse(savedRules);
        console.log('📋 Loaded moderation rules from localStorage:', parsedRules.length);
        return parsedRules;
      }
    } catch (error) {
      console.error('Failed to load moderation rules from localStorage:', error);
    }
    
    // Return default rules if no saved rules found
    const defaultRules: ModerationRule[] = [
      {
        id: '1',
        name: 'Hate Speech Detection',
        description: 'Automatically flag content containing hate speech or discriminatory language',
        category: 'Safety',
        enabled: true,
        severity: 'critical',
        keywords: ['hate', 'discrimination', 'offensive'],
        action: 'block'
      },
      {
        id: '2',
        name: 'Spam Filter',
        description: 'Detect and filter spam content and promotional messages',
        category: 'Quality',
        enabled: true,
        severity: 'medium',
        keywords: ['spam', 'promotion', 'click here', 'free money'],
        action: 'flag'
      },
      {
        id: '3',
        name: 'Explicit Content',
        description: 'Flag explicit or inappropriate visual content',
        category: 'Safety',
        enabled: true,
        severity: 'high',
        keywords: ['explicit', 'inappropriate', 'nsfw'],
        action: 'review'
      }
    ];
    
    console.log('📋 Using default moderation rules');
    return defaultRules;
  };

  // Save moderation rules to localStorage
  const saveModerationRules = (rules: ModerationRule[]) => {
    try {
      localStorage.setItem('moderationRules', JSON.stringify(rules));
      console.log('💾 Saved moderation rules to localStorage:', rules.length);
    } catch (error) {
      console.error('Failed to save moderation rules to localStorage:', error);
    }
  };

  // Initialize with real content only (no sample data)
  useEffect(() => {
    // Load moderation rules from localStorage
    const rules = loadModerationRules();
    setModerationRules(rules);
    
    // No sample content - start with empty array
    setContentItems([]);
    
    console.log('🚀 Initialized with real content only (no sample data)');
  }, []);

  const handleStartMonitoring = () => {
    setIsMonitoring(true);
    toast({
      title: 'Monitoring Started',
      description: 'Real-time content monitoring is now active across all connected platforms.',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleStopMonitoring = () => {
    setIsMonitoring(false);
    toast({
      title: 'Monitoring Stopped',
      description: 'Real-time content monitoring has been paused.',
      status: 'warning',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleContentAction = (contentId: string, action: 'approve' | 'reject' | 'flag') => {
    setContentItems(prev => prev.map(item => 
      item.id === contentId 
        ? { ...item, status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'flagged' }
        : item
    ));
    
    toast({
      title: `Content ${action}d`,
      description: `The content has been successfully ${action}d.`,
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  // Handle moderation actions for replies
  const handleModerationAction = async (action: 'hide' | 'mute' | 'block', replyId: string, authorId: string) => {
    try {
      const twitterCredentials = platformAuth.getStoredCredentials('twitter');
      if (!twitterCredentials) {
        throw new Error('Twitter credentials not found');
      }

      let success = false;
      let actionText = '';

      switch (action) {
        case 'hide':
          success = await contentFetcher.hideTwitterReply(replyId, twitterCredentials.accessToken, twitterCredentials.userId);
          actionText = 'hidden';
          break;
        case 'mute':
          // Find the reply to get the username
          const muteReply = realContent.find(content => 
            content.replies?.some(r => r.author.id === authorId)
          )?.replies?.find(r => r.author.id === authorId);
          
          success = await contentFetcher.muteTwitterUser(
            twitterCredentials.userId, 
            authorId, 
            twitterCredentials.accessToken,
            muteReply?.author.username
          );
          actionText = 'muted';
          break;
        case 'block':
          // Find the reply to get the username
          const reply = realContent.find(content => 
            content.replies?.some(r => r.author.id === authorId)
          )?.replies?.find(r => r.author.id === authorId);
          
          success = await contentFetcher.blockTwitterUser(
            twitterCredentials.userId, 
            authorId, 
            twitterCredentials.accessToken,
            reply?.author.username
          );
          actionText = 'blocked';
          break;
      }

      if (success) {
        // Check if this is a local-only action
        const isLocalOnly = success && typeof success === 'object' && success.localOnly;
        
        toast({
          title: isLocalOnly ? `User ${actionText.charAt(0).toUpperCase() + actionText.slice(1)} (App Only)` : `User ${actionText}`,
          description: isLocalOnly 
            ? `User ${actionText} in your app view. For full Twitter ${action}ing, visit their profile.`
            : `The user has been ${actionText} successfully.`,
          status: isLocalOnly ? 'warning' : 'success',
          duration: isLocalOnly ? 8000 : 3000,
          isClosable: true,
        });

        // If local only, show additional info with link
        if (isLocalOnly) {
          setTimeout(() => {
            if (success.twitterBlockUrl) {
              // Block instructions
              const username = success.targetUsername || `User ${success.targetUserId}`;
              toast({
                title: `🔗 Block ${username} on Twitter`,
                description: (
                  <div style={{ fontSize: '14px' }}>
                    <p style={{ marginBottom: '8px' }}>To actually block this user on Twitter:</p>
                    <ol style={{ marginLeft: '16px', marginBottom: '8px' }}>
                      <li>Click the link below to open their profile</li>
                      <li>Click the "..." menu (three dots)</li>
                      <li>Select "Block @{username.replace('@', '')}"</li>
                    </ol>
                    <a 
                      href={success.twitterBlockUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        color: '#1DA1F2', 
                        textDecoration: 'underline',
                        fontWeight: 'bold'
                      }}
                    >
                      Open {username}'s Twitter Profile →
                    </a>
                  </div>
                ),
                status: 'info',
                duration: 15000,
                isClosable: true,
              });
            } else if (success.twitterMuteUrl) {
              // Mute instructions
              const username = success.targetUsername || `User ${success.targetUserId}`;
              toast({
                title: `🔇 Mute ${username} on Twitter`,
                description: (
                  <div style={{ fontSize: '14px' }}>
                    <p style={{ marginBottom: '8px' }}>To actually mute this user on Twitter:</p>
                    <ol style={{ marginLeft: '16px', marginBottom: '8px' }}>
                      <li>Click the link below to open their profile</li>
                      <li>Click the "..." menu (three dots)</li>
                      <li>Select "Mute @{username.replace('@', '')}"</li>
                    </ol>
                    <a 
                      href={success.twitterMuteUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        color: '#1DA1F2', 
                        textDecoration: 'underline',
                        fontWeight: 'bold'
                      }}
                    >
                      Open {username}'s Twitter Profile →
                    </a>
                  </div>
                ),
                status: 'info',
                duration: 15000,
                isClosable: true,
              });
            } else if (success.twitterReplyUrl) {
              // Hide reply instructions
              toast({
                title: `👁️ Hide Reply on Twitter`,
                description: (
                  <div style={{ fontSize: '14px' }}>
                    <p style={{ marginBottom: '8px' }}>To hide this reply on Twitter:</p>
                    <ol style={{ marginLeft: '16px', marginBottom: '8px' }}>
                      <li>Click the link below to open the reply</li>
                      <li>Click the "..." menu on the reply</li>
                      <li>Select "Hide reply"</li>
                    </ol>
                    <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                      ⚠️ Note: You can only hide replies on your own tweets
                    </p>
                    <a 
                      href={success.twitterReplyUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        color: '#1DA1F2', 
                        textDecoration: 'underline',
                        fontWeight: 'bold'
                      }}
                    >
                      Open Reply on Twitter →
                    </a>
                  </div>
                ),
                status: 'info',
                duration: 15000,
                isClosable: true,
              });
            }
          }, 1000);
        }

        // Refresh content to reflect changes
        await loadRealContent();
      }
    } catch (error: any) {
      console.error(`Moderation action failed:`, error);
      toast({
        title: 'Moderation Failed',
        description: error.message || 'Failed to perform moderation action',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleCreateRule = () => {
    if (!newRule.name || !newRule.description) {
      toast({
        title: 'Missing Information',
        description: 'Please provide both name and description for the rule.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const rule: ModerationRule = {
      id: Date.now().toString(),
      name: newRule.name,
      description: newRule.description,
      category: newRule.category || 'Custom',
      enabled: true,
      severity: newRule.severity || 'medium',
      keywords: newRule.keywords || [],
      action: newRule.action || 'flag'
    };

    const updatedRules = [...moderationRules, rule];
    setModerationRules(updatedRules);
    saveModerationRules(updatedRules); // Save to localStorage
    setNewRule({ keywordText: '' });
    onRuleModalClose();
    
    toast({
      title: 'Rule Created',
      description: `Moderation rule "${rule.name}" has been created and saved successfully.`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  // Toggle rule enabled/disabled state
  const handleToggleRule = (ruleId: string) => {
    const updatedRules = moderationRules.map(rule => 
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
    );
    setModerationRules(updatedRules);
    saveModerationRules(updatedRules); // Save to localStorage
    
    const rule = moderationRules.find(r => r.id === ruleId);
    toast({
      title: 'Rule Updated',
      description: `Rule "${rule?.name}" has been ${rule?.enabled ? 'disabled' : 'enabled'}.`,
      status: 'info',
      duration: 2000,
      isClosable: true,
    });
  };

  // Delete a moderation rule
  const handleDeleteRule = (ruleId: string) => {
    const rule = moderationRules.find(r => r.id === ruleId);
    const updatedRules = moderationRules.filter(rule => rule.id !== ruleId);
    setModerationRules(updatedRules);
    saveModerationRules(updatedRules); // Save to localStorage
    
    toast({
      title: 'Rule Deleted',
      description: `Moderation rule "${rule?.name}" has been deleted successfully.`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  // Bulk operations
  const handleSelectAll = () => {
    if (selectedItems.size === filteredContent.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredContent.map(item => item.id)));
    }
  };

  const handleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleBulkAction = (action: 'approve' | 'reject' | 'flag') => {
    const updatedContent = allContent.map(item => {
      if (selectedItems.has(item.id)) {
        return { ...item, status: action === 'flag' ? 'flagged' : (action + 'd') as any };
      }
      return item;
    });
    
    // Update the processed content items
    setProcessedContentItems(updatedContent);
    setSelectedItems(new Set());
    
    toast({
      title: 'Bulk Action Completed',
      description: `${selectedItems.size} items ${action}${action === 'flag' ? 'ged' : 'd'}`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  // Save and load filter presets
  const saveFilterPreset = (name: string) => {
    const preset = {
      id: Date.now().toString(),
      name,
      filters: {
        severity: filterSeverity,
        status: filterStatus,
        platform: filterPlatform,
        sentiment: filterSentiment,
        toxicity: filterToxicity,
        brandSafety: filterBrandSafety,
        dateRange,
        searchTerm
      }
    };
    
    const updatedFilters = [...savedFilters, preset];
    setSavedFilters(updatedFilters);
    localStorage.setItem('savedFilters', JSON.stringify(updatedFilters));
    
    toast({
      title: 'Filter Saved',
      description: `Filter preset "${name}" saved successfully`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const loadFilterPreset = (preset: any) => {
    setFilterSeverity(preset.filters.severity);
    setFilterStatus(preset.filters.status);
    setFilterPlatform(preset.filters.platform);
    setFilterSentiment(preset.filters.sentiment);
    setFilterToxicity(preset.filters.toxicity);
    setFilterBrandSafety(preset.filters.brandSafety);
    setDateRange(preset.filters.dateRange);
    setSearchTerm(preset.filters.searchTerm);
  };

  const clearAllFilters = () => {
    setFilterSeverity('all');
    setFilterStatus('all');
    setFilterPlatform('all');
    setFilterSentiment('all');
    setFilterToxicity('all');
    setFilterBrandSafety('all');
    setDateRange({ start: '', end: '' });
    setSearchTerm('');
  };

  // Export functions
  const handleExport = (format: 'csv' | 'pdf' | 'json') => {
    const stats = exportService.generateStats(filteredContent);
    const options: ExportOptions = {
      format,
      includeAnalysis: true,
      dateRange,
      filters: {
        severity: filterSeverity,
        status: filterStatus,
        platform: filterPlatform,
        sentiment: filterSentiment,
        toxicity: filterToxicity,
        brandSafety: filterBrandSafety
      }
    };

    switch (format) {
      case 'csv':
        exportService.exportToCSV(filteredContent, options);
        break;
      case 'json':
        exportService.exportToJSON(filteredContent, stats, options);
        break;
      case 'pdf':
        exportService.exportToPDF(filteredContent, stats);
        break;
    }

    toast({
      title: 'Export Completed',
      description: `Data exported as ${format.toUpperCase()} successfully`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleExportRules = () => {
    exportService.exportModerationRules(moderationRules);
    toast({
      title: 'Rules Exported',
      description: 'Moderation rules exported successfully',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleImportRules = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    exportService.importModerationRules(file)
      .then(importedRules => {
        setModerationRules(importedRules);
        saveModerationRules(importedRules);
        toast({
          title: 'Rules Imported',
          description: `${importedRules.length} moderation rules imported successfully`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      })
      .catch(error => {
        toast({
          title: 'Import Failed',
          description: error.message,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      });
  };

  // Enhanced AI Content Analysis Function
  const analyzeContent = async (content: string, author: string, platform: string): Promise<{ severity: 'low' | 'medium' | 'high' | 'critical', category: string, aiConfidence: number, status: 'pending' | 'flagged', aiAnalysis?: AIAnalysisResult, sentiment?: 'positive' | 'negative' | 'neutral', toxicity?: number, brandSafety?: number }> => {
    try {
      // Build context for AI analysis
      const context: ModerationContext = {
        platform,
        author: {
          id: 'unknown',
          name: author,
          verified: false
        },
        engagement: {
          likes: 0,
          shares: 0,
          comments: 0
        }
      };

      // Check AI availability before analysis
      const isAIAvailable = aiModerationService.isAIAvailable();
      setAiAvailable(isAIAvailable);
      
      // Get AI analysis
      const aiAnalysis = await aiModerationService.analyzeContent(content, context, moderationRules);
      
      // Check if AI analysis was actually used (not fallback)
      if (!isAIAvailable && !showQuotaWarning) {
        setShowQuotaWarning(true);
        toast({
          title: '💳 AI Analysis Unavailable',
          description: 'OpenAI quota exceeded. Switched to basic analysis mode. Content moderation continues working perfectly!',
          status: 'info',
          duration: 10000,
          isClosable: true,
        });
      }
      
      // Map AI results to existing format
      const status = aiAnalysis.recommendations.action === 'approve' ? 'pending' : 'flagged';
      
      return {
        severity: aiAnalysis.severity,
        category: aiAnalysis.category,
        aiConfidence: Math.round(aiAnalysis.recommendations.confidence * 100),
        status,
        aiAnalysis,
        sentiment: aiAnalysis.sentiment,
        toxicity: aiAnalysis.toxicity,
        brandSafety: aiAnalysis.brandSafety
      };
    } catch (error) {
      console.error('AI analysis failed, using fallback:', error);
      return analyzeContentFallback(content, author);
    }
  };

  // Fallback analysis function (original logic)
  const analyzeContentFallback = (content: string, author: string): { severity: 'low' | 'medium' | 'high' | 'critical', category: string, aiConfidence: number, status: 'pending' | 'flagged' } => {
    // Normalize text for analysis (preserve original case for Arabic)
    const text = content.toLowerCase();
    const originalText = content; // Keep original for Arabic analysis
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let category = 'General';
    let aiConfidence = 70;
    let status: 'pending' | 'flagged' = 'pending';

    // Helper function for multilingual keyword matching
    const containsKeywords = (text: string, keywords: string[]): boolean => {
      return keywords.some(keyword => {
        // For Arabic and other RTL languages, use includes without case conversion
        if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(keyword)) {
          return originalText.includes(keyword);
        }
        // For Latin scripts, use lowercase matching
        return text.includes(keyword.toLowerCase());
      });
    };

    // Spam detection (English + Arabic)
    const spamKeywords = [
      // English
      'click here', 'free money', 'win now', 'limited time', 'act now', 'urgent', 'exclusive',
      // Arabic spam terms
      'اضغط هنا', 'مال مجاني', 'اربح الآن', 'وقت محدود', 'عرض خاص', 'حصري', 'مجاني', 'ربح سريع',
      'استثمار مضمون', 'فرصة ذهبية', 'عمل من المنزل', 'دخل إضافي', 'بدون خبرة'
    ];
    
    if (containsKeywords(originalText, spamKeywords) || /(.)\1{4,}/.test(text) || text.length > 500) {
      severity = 'medium';
      category = 'Spam';
      aiConfidence = 85;
      status = 'flagged';
    }

    // Hate speech detection (English + Arabic)
    const hateSpeechKeywords = [
      // English
      'hate', 'stupid', 'idiot', 'kill', 'die', 'racist', 'discrimination',
      // Arabic hate speech terms
      'كراهية', 'غبي', 'أحمق', 'اقتل', 'مت', 'عنصري', 'تمييز', 'كره', 'بغض',
      'احتقار', 'ازدراء', 'سب', 'شتم', 'لعن', 'قبيح', 'وسخ', 'حقير', 'ذليل'
    ];
    
    if (containsKeywords(originalText, hateSpeechKeywords)) {
      severity = 'high';
      category = 'Hate Speech';
      aiConfidence = 90;
      status = 'flagged';
    }

    // Scam detection (English + Arabic)
    const scamKeywords = [
      // English
      'scam', 'fraud', 'bitcoin', 'investment', 'crypto', 'get rich quick',
      // Arabic scam terms
      'نصب', 'احتيال', 'بيتكوين', 'استثمار', 'عملة رقمية', 'ربح سريع', 'مال سهل',
      'فوركس', 'تداول', 'أرباح مضمونة', 'استثمار آمن', 'عوائد عالية', 'مشروع مربح'
    ];
    
    if (containsKeywords(originalText, scamKeywords)) {
      severity = 'critical';
      category = 'Scam';
      aiConfidence = 95;
      status = 'flagged';
    }

    // Harassment detection (English + Arabic)
    const harassmentKeywords = [
      // English
      'loser', 'pathetic', 'worthless', 'harassment', 'bullying',
      // Arabic harassment terms
      'فاشل', 'تافه', 'عديم القيمة', 'مضايقة', 'تنمر', 'إذلال', 'إهانة', 'تحقير',
      'استفزاز', 'إزعاج', 'تهديد', 'وعيد', 'ترهيب'
    ];
    
    if (text.includes('@') && containsKeywords(originalText, harassmentKeywords)) {
      severity = 'high';
      category = 'Harassment';
      aiConfidence = 88;
      status = 'flagged';
    }

    // Positive content (English + Arabic)
    const positiveKeywords = [
      // English
      'great', 'awesome', 'love', 'thank', 'amazing', 'excellent', 'wonderful',
      // Arabic positive terms
      'رائع', 'ممتاز', 'حب', 'شكرا', 'مذهل', 'جميل', 'عظيم', 'مبدع', 'متميز',
      'شكرا لك', 'بارك الله فيك', 'جزاك الله خيرا', 'أحسنت', 'مبروك', 'تهانينا'
    ];
    
    if (containsKeywords(originalText, positiveKeywords)) {
      severity = 'low';
      category = 'Positive';
      aiConfidence = 80;
      status = 'pending';
    }

    // Check against custom moderation rules with Arabic support
    for (const rule of moderationRules) {
      if (rule.enabled && rule.keywords.length > 0) {
        if (containsKeywords(originalText, rule.keywords)) {
          severity = rule.severity;
          category = rule.category;
          aiConfidence = Math.min(95, aiConfidence + 10); // Boost confidence for rule matches
          status = rule.action === 'auto-approve' ? 'pending' : 'flagged';
          break; // Use first matching rule
        }
      }
    }

    return { severity, category, aiConfidence, status };
  };

  // State for processed content items
  const [processedContentItems, setProcessedContentItems] = useState<ContentItem[]>([]);
  const [isProcessingContent, setIsProcessingContent] = useState(false);

  // Process real content with AI analysis
  const processContentWithAI = useCallback(async (content: SocialContent[]) => {
    if (content.length === 0) {
      setProcessedContentItems([]);
      return;
    }

    setIsProcessingContent(true);
    console.log('🧠 Processing content with AI analysis...');

    try {
      const items: ContentItem[] = [];
      
      // Process main posts
      for (const item of content) {
        const mainAnalysis = await analyzeContent(
          item.content, 
          item.author.name || item.author.username || 'Unknown',
          item.platform
        );
        
        items.push({
          id: item.id,
          platform: item.platform,
          content: item.content,
          author: item.author.name || item.author.username || 'Unknown',
          timestamp: item.timestamp,
          status: mainAnalysis.status,
          severity: mainAnalysis.severity,
          category: mainAnalysis.category,
          aiConfidence: mainAnalysis.aiConfidence,
          aiAnalysis: mainAnalysis.aiAnalysis,
          sentiment: mainAnalysis.sentiment,
          toxicity: mainAnalysis.toxicity,
          brandSafety: mainAnalysis.brandSafety
        });

        // Process replies
        if (item.replies) {
          for (const reply of item.replies) {
            const replyAnalysis = await analyzeContent(
              reply.content,
              reply.author.name || reply.author.username || 'Unknown',
              item.platform
            );
            
            items.push({
              id: `${item.id}_reply_${reply.id}`,
              platform: item.platform,
              content: `Reply: ${reply.content}`,
              author: reply.author.name || reply.author.username || 'Unknown',
              timestamp: reply.timestamp,
              status: replyAnalysis.status,
              severity: replyAnalysis.severity,
              category: replyAnalysis.category,
              aiConfidence: replyAnalysis.aiConfidence,
              aiAnalysis: replyAnalysis.aiAnalysis,
              sentiment: replyAnalysis.sentiment,
              toxicity: replyAnalysis.toxicity,
              brandSafety: replyAnalysis.brandSafety
            });
          }
        }
      }

      setProcessedContentItems(items);
      console.log(`✅ Processed ${items.length} content items with AI analysis`);
      
    } catch (error) {
      console.error('❌ Failed to process content with AI:', error);
      // Fallback to basic processing
      const fallbackItems = content.flatMap(item => {
        const mainAnalysis = analyzeContentFallback(item.content, item.author.name || '');
        return [{
          id: item.id,
          platform: item.platform,
          content: item.content,
          author: item.author.name || item.author.username || 'Unknown',
          timestamp: item.timestamp,
          status: mainAnalysis.status,
          severity: mainAnalysis.severity,
          category: mainAnalysis.category,
          aiConfidence: mainAnalysis.aiConfidence
        }];
      });
      setProcessedContentItems(fallbackItems);
    } finally {
      setIsProcessingContent(false);
    }
  }, [moderationRules]);

  // Process content when realContent changes
  useEffect(() => {
    processContentWithAI(realContent);
  }, [realContent, processContentWithAI]);

  // Handle WebSocket messages - DISABLED (no WebSocket server)
  /*
  useEffect(() => {
    if (lastMessage) {
      switch (lastMessage.type) {
        case 'content_update':
          console.log('📨 New content update received:', lastMessage.data);
          // Refresh content when new updates arrive
          loadRealContent();
          break;
        case 'moderation_action':
          console.log('⚡ Moderation action received:', lastMessage.data);
          // Update UI to reflect moderation actions from other users
          break;
        case 'platform_status':
          console.log('🔗 Platform status update:', lastMessage.data);
          // Update platform connection status
          break;
      }
    }
  }, [lastMessage]);
  */

  // Use processed content items
  const allContent = [...processedContentItems];

  // Generate dashboard statistics
  const generateDashboardStats = useCallback(() => {
    const totalContent = allContent.length;
    const flaggedContent = allContent.filter(item => item.status === 'flagged').length;
    const approvedContent = allContent.filter(item => item.status === 'approved').length;
    const pendingContent = allContent.filter(item => item.status === 'pending').length;
    
    const toxicityValues = allContent.filter(item => item.toxicity !== undefined).map(item => item.toxicity!);
    const brandSafetyValues = allContent.filter(item => item.brandSafety !== undefined).map(item => item.brandSafety!);
    
    const avgToxicity = toxicityValues.length > 0 
      ? toxicityValues.reduce((sum, val) => sum + val, 0) / toxicityValues.length 
      : 0;
    
    const avgBrandSafety = brandSafetyValues.length > 0 
      ? brandSafetyValues.reduce((sum, val) => sum + val, 0) / brandSafetyValues.length 
      : 0.5;

    const platformActivity = allContent.reduce((acc, item) => {
      acc[item.platform] = (acc[item.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const recentActivity = allContent
      .filter(item => item.status !== 'pending')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10)
      .map(item => ({
        id: item.id,
        action: item.status,
        platform: item.platform,
        timestamp: item.timestamp,
        severity: item.severity
      }));

    return {
      totalContent,
      flaggedContent,
      approvedContent,
      pendingContent,
      avgToxicity,
      avgBrandSafety,
      platformActivity,
      recentActivity,
      aiPerformance: {
        accuracy: 0.92, // This would come from actual AI performance metrics
        processingSpeed: 150, // Average processing time in ms
        confidence: allContent.length > 0 
          ? allContent.reduce((sum, item) => sum + item.aiConfidence, 0) / allContent.length / 100
          : 0.8
      }
    };
  }, [allContent]);

  const dashboardStats = generateDashboardStats();

  const filteredContent = allContent.filter(item => {
    const matchesSeverity = filterSeverity === 'all' || item.severity === filterSeverity;
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchesPlatform = filterPlatform === 'all' || item.platform === filterPlatform;
    
    // Enhanced search with Arabic support and advanced operators
    const matchesSearch = searchTerm === '' || (() => {
      const term = searchTerm.toLowerCase();
      
      // Support for search operators
      if (term.startsWith('author:')) {
        const authorTerm = term.replace('author:', '').trim();
        return item.author.toLowerCase().includes(authorTerm);
      }
      
      if (term.startsWith('category:')) {
        const categoryTerm = term.replace('category:', '').trim();
        return item.category.toLowerCase().includes(categoryTerm);
      }
      
      if (term.startsWith('platform:')) {
        const platformTerm = term.replace('platform:', '').trim();
        return item.platform.toLowerCase().includes(platformTerm);
      }
      
      // Default search across content, author, and category
      const searchLower = searchTerm.toLowerCase();
      const contentLower = item.content.toLowerCase();
      const authorLower = item.author.toLowerCase();
      
      // For Arabic and RTL text, also search without case conversion
      const matchesArabic = item.content.includes(searchTerm) || item.author.includes(searchTerm);
      const matchesLatin = contentLower.includes(searchLower) || authorLower.includes(searchLower) || 
                          item.category.toLowerCase().includes(searchLower);
      
      return matchesArabic || matchesLatin;
    })();
    
    // Advanced filters
    const matchesSentiment = filterSentiment === 'all' || item.sentiment === filterSentiment;
    
    const matchesToxicity = filterToxicity === 'all' || (() => {
      if (!item.toxicity) return true;
      switch (filterToxicity) {
        case 'low': return item.toxicity < 0.3;
        case 'medium': return item.toxicity >= 0.3 && item.toxicity < 0.7;
        case 'high': return item.toxicity >= 0.7;
        default: return true;
      }
    })();
    
    const matchesBrandSafety = filterBrandSafety === 'all' || (() => {
      if (!item.brandSafety) return true;
      switch (filterBrandSafety) {
        case 'safe': return item.brandSafety >= 0.7;
        case 'moderate': return item.brandSafety >= 0.4 && item.brandSafety < 0.7;
        case 'risky': return item.brandSafety < 0.4;
        default: return true;
      }
    })();
    
    // Date range filter
    const matchesDateRange = (() => {
      if (!dateRange.start && !dateRange.end) return true;
      const itemDate = new Date(item.timestamp);
      const startDate = dateRange.start ? new Date(dateRange.start) : null;
      const endDate = dateRange.end ? new Date(dateRange.end) : null;
      
      if (startDate && itemDate < startDate) return false;
      if (endDate && itemDate > endDate) return false;
      return true;
    })();
    
    return matchesSeverity && matchesStatus && matchesPlatform && matchesSearch && 
           matchesSentiment && matchesToxicity && matchesBrandSafety && matchesDateRange;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'green';
      case 'rejected': return 'red';
      case 'flagged': return 'orange';
      case 'pending': return 'blue';
      default: return 'gray';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'yellow';
      case 'low': return 'green';
      default: return 'gray';
    }
  };

  return (
    <Box w="full" h="full" p={6}>
      <VStack spacing={6} align="stretch">
        <HStack justify="space-between" align="center">
          <VStack align="start" spacing={1}>
            <HStack>
              <Heading size="lg" color="purple.600">
                🛡️ Social Media Moderation
              </Heading>
              {!aiAvailable && (
                <Badge colorScheme="orange" variant="solid">
                  Basic Analysis Mode
                </Badge>
              )}
              {aiAvailable && (
                <Badge colorScheme="green" variant="solid">
                  AI Enhanced
                </Badge>
              )}
            </HStack>
            <Text color="gray.600" fontSize="sm">
              Advanced AI-powered content moderation with real-time monitoring and iCloud integration
            </Text>
          </VStack>
          
          <HStack spacing={3}>
            <Button
              leftIcon={<Icon as={isMonitoring ? FaPause : FaPlay} />}
              colorScheme={isMonitoring ? "orange" : "green"}
              onClick={isMonitoring ? handleStopMonitoring : handleStartMonitoring}
              size="sm"
            >
              {isMonitoring ? 'Pause' : 'Start'} Monitoring
            </Button>
            <Button
              leftIcon={<Icon as={FaSyncAlt} />}
              variant="outline"
              onClick={() => window.location.reload()}
              size="sm"
            >
              Refresh
            </Button>
          </HStack>
        </HStack>

        {/* Status Cards */}
        <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4}>
          <GridItem>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>Content Processed Today</StatLabel>
                  <StatNumber>{contentStats.totalPosts.toLocaleString()}</StatNumber>
                  <StatHelpText>
                    <StatArrow type="increase" />
                    {contentStats.totalPosts > 0 ? 'Real data from connected platforms' : 'Connect platforms to see data'}
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </GridItem>
          
          <GridItem>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>Flagged Content</StatLabel>
                  <StatNumber color="orange.500">{contentStats.flaggedContent}</StatNumber>
                  <StatHelpText>
                    <StatArrow type={contentStats.flaggedContent > 0 ? "increase" : "decrease"} />
                    {contentStats.flaggedContent > 0 ? 'AI-detected suspicious content' : 'No flagged content'}
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </GridItem>
          
          <GridItem>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>Total Engagement</StatLabel>
                  <StatNumber color="green.500">{(contentStats.engagementTotals.likes + contentStats.engagementTotals.comments + contentStats.engagementTotals.shares).toLocaleString()}</StatNumber>
                  <StatHelpText>
                    <StatArrow type="increase" />
                    Likes, comments & shares combined
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </GridItem>
          
          <GridItem>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>Active Platforms</StatLabel>
                  <StatNumber>{platforms.filter(p => p.enabled && p.connected).length}</StatNumber>
                  <StatHelpText>of {platforms.length} configured</StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>

        <Tabs variant="enclosed" colorScheme="purple">
          <TabList>
            <Tab><Icon as={FaChartLine} mr={2} />Live Dashboard</Tab>
            <Tab><Icon as={FaComments} mr={2} />Social Chat</Tab>
            <Tab><Icon as={FaPaperPlane} mr={2} />Post Creator</Tab>
            <Tab><Icon as={FaEye} mr={2} />Real-time Monitor</Tab>
            <Tab><Icon as={FaRobot} mr={2} />AI Filtering</Tab>
            <Tab><Icon as={FaGlobe} mr={2} />Platforms</Tab>
            <Tab><Icon as={FaUsers} mr={2} />User Management</Tab>
            <Tab><Icon as={FaCog} mr={2} />Settings</Tab>
          </TabList>

          <TabPanels>
            {/* Live Dashboard Tab */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                <Alert status="info">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Real-time Dashboard</AlertTitle>
                    <AlertDescription>
                      Live dashboard temporarily disabled. Use the other tabs to view content and analytics.
                    </AlertDescription>
                  </Box>
                </Alert>
                
                <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
                  <Stat bg={useColorModeValue('white', 'gray.800')} p={4} borderRadius="md" boxShadow="sm">
                    <StatLabel>Total Content</StatLabel>
                    <StatNumber>{dashboardStats.totalContent}</StatNumber>
                    <StatHelpText>Processed items</StatHelpText>
                  </Stat>
                  
                  <Stat bg={useColorModeValue('white', 'gray.800')} p={4} borderRadius="md" boxShadow="sm">
                    <StatLabel>Flagged</StatLabel>
                    <StatNumber color="orange.500">{dashboardStats.flaggedContent}</StatNumber>
                    <StatHelpText>Needs review</StatHelpText>
                  </Stat>
                  
                  <Stat bg={useColorModeValue('white', 'gray.800')} p={4} borderRadius="md" boxShadow="sm">
                    <StatLabel>Approved</StatLabel>
                    <StatNumber color="green.500">{dashboardStats.approvedContent}</StatNumber>
                    <StatHelpText>Safe content</StatHelpText>
                  </Stat>
                  
                  <Stat bg={useColorModeValue('white', 'gray.800')} p={4} borderRadius="md" boxShadow="sm">
                    <StatLabel>Pending</StatLabel>
                    <StatNumber color="blue.500">{dashboardStats.pendingContent}</StatNumber>
                    <StatHelpText>Awaiting review</StatHelpText>
                  </Stat>
                </SimpleGrid>
              </VStack>
            </TabPanel>

            {/* Social Chat Tab */}
            <TabPanel>
              <SocialChatTab 
                connectedPlatforms={React.useMemo(() => 
                  platforms.filter(p => p.connected).map(p => p.id), 
                  [platforms.map(p => `${p.id}:${p.connected}`).join(',')]
                )}
              />
            </TabPanel>

            {/* Post Creator Tab */}
            <TabPanel>
              <SocialPostingTab 
                connectedPlatforms={platforms.filter(p => p.connected).map(p => p.id)}
              />
            </TabPanel>

            {/* Real-time Monitor Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                {/* Live Data Indicator - Disabled */}
                <LiveIndicator
                  isLive={false}
                  lastUpdated={null}
                  isLoading={false}
                  onToggleLive={() => {}}
                  onRefresh={() => {}}
                  updateInterval={120000}
                  onIntervalChange={() => {}}
                />
                
                {/* Connected Platforms Overview */}
                <Card>
                  <CardHeader>
                    <Text fontSize="lg" fontWeight="bold">Connected Platforms</Text>
                  </CardHeader>
                  <CardBody>
                    <HStack spacing={4} wrap="wrap">
                      {platforms.filter(p => p.connected).map(platform => (
                        <Card key={platform.id} variant="outline" minW="200px">
                          <CardBody p={3}>
                            <HStack spacing={3}>
                              <Icon as={platform.icon} color="blue.500" boxSize={6} />
                              <VStack align="start" spacing={1} flex={1}>
                                <Text fontWeight="bold" fontSize="sm">{platform.name}</Text>
                                <Text fontSize="xs" color="gray.600">
                                  @{platform.userName || 'Unknown'}
                                </Text>
                                <Badge colorScheme="green" size="sm">
                                  {contentStats.platformBreakdown[platform.id] || 0} posts
                                </Badge>
                              </VStack>
                            </HStack>
                          </CardBody>
                        </Card>
                      ))}
                      {platforms.filter(p => p.connected).length === 0 && (
                        <Text color="gray.500" fontStyle="italic">
                          No platforms connected. Go to the Platforms tab to connect your accounts.
                        </Text>
                      )}
                    </HStack>
                  </CardBody>
                </Card>

                <VStack spacing={4} align="stretch">
                  <HStack spacing={4} wrap="wrap">
                    <Input
                      placeholder="Search content or authors... (English/Arabic supported)"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      maxW="350px"
                      dir="auto"
                      style={{ 
                        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Noto Sans Arabic", "Arabic UI Text"'
                      }}
                    />
                    
                    <Select
                      value={filterSeverity}
                      onChange={(e) => setFilterSeverity(e.target.value)}
                      maxW="150px"
                    >
                      <option value="all">All Severity</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </Select>
                    
                    <Select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      maxW="150px"
                    >
                      <option value="all">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="flagged">Flagged</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </Select>
                    
                    <Select
                      value={filterPlatform}
                      onChange={(e) => setFilterPlatform(e.target.value)}
                      maxW="150px"
                    >
                      <option value="all">All Platforms</option>
                      {platforms.filter(p => p.connected).map(platform => (
                        <option key={platform.id} value={platform.id}>
                          {platform.name}
                        </option>
                      ))}
                    </Select>

                    <Spacer />

                    {/* Export Buttons */}
                    <HStack spacing={2}>
                      <Button
                        size="sm"
                        leftIcon={<FaDownload />}
                        onClick={() => handleExport('csv')}
                        colorScheme="blue"
                        variant="outline"
                      >
                        CSV
                      </Button>
                      <Button
                        size="sm"
                        leftIcon={<FaDownload />}
                        onClick={() => handleExport('json')}
                        colorScheme="green"
                        variant="outline"
                      >
                        JSON
                      </Button>
                      <Button
                        size="sm"
                        leftIcon={<FaDownload />}
                        onClick={() => handleExport('pdf')}
                        colorScheme="red"
                        variant="outline"
                      >
                        PDF
                      </Button>
                    </HStack>
                  </HStack>

                  {/* Advanced Filters Row */}
                  <HStack spacing={4} wrap="wrap">
                    <Select
                      value={filterSentiment}
                      onChange={(e) => setFilterSentiment(e.target.value)}
                      maxW="150px"
                      placeholder="Sentiment"
                    >
                      <option value="all">All Sentiment</option>
                      <option value="positive">Positive</option>
                      <option value="negative">Negative</option>
                      <option value="neutral">Neutral</option>
                    </Select>

                    <Select
                      value={filterToxicity}
                      onChange={(e) => setFilterToxicity(e.target.value)}
                      maxW="150px"
                      placeholder="Toxicity"
                    >
                      <option value="all">All Toxicity</option>
                      <option value="low">Low (&lt;30%)</option>
                      <option value="medium">Medium (30-70%)</option>
                      <option value="high">High (&gt;70%)</option>
                    </Select>

                    <Select
                      value={filterBrandSafety}
                      onChange={(e) => setFilterBrandSafety(e.target.value)}
                      maxW="150px"
                      placeholder="Brand Safety"
                    >
                      <option value="all">All Safety</option>
                      <option value="safe">Safe (&gt;70%)</option>
                      <option value="moderate">Moderate (40-70%)</option>
                      <option value="risky">Risky (&lt;40%)</option>
                    </Select>

                    <Button
                      size="sm"
                      onClick={clearAllFilters}
                      variant="ghost"
                      leftIcon={<FaSync />}
                    >
                      Clear Filters
                    </Button>

                    {/* Bulk Actions */}
                    {selectedItems.size > 0 && (
                      <HStack spacing={2} ml={4}>
                        <Text fontSize="sm" color="gray.600">
                          {selectedItems.size} selected
                        </Text>
                        <Button
                          size="sm"
                          colorScheme="green"
                          onClick={() => handleBulkAction('approve')}
                        >
                          Approve All
                        </Button>
                        <Button
                          size="sm"
                          colorScheme="red"
                          onClick={() => handleBulkAction('reject')}
                        >
                          Reject All
                        </Button>
                        <Button
                          size="sm"
                          colorScheme="orange"
                          onClick={() => handleBulkAction('flag')}
                        >
                          Flag All
                        </Button>
                      </HStack>
                    )}
                  </HStack>
                </VStack>

                <Card>
                  <CardHeader>
                    <HStack justify="space-between">
                      <HStack spacing={4}>
                        <Text fontSize="lg" fontWeight="bold">Content Queue ({filteredContent.length})</Text>
                        {filteredContent.length > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleSelectAll}
                            leftIcon={selectedItems.size === filteredContent.length ? <FaCheck /> : <FaEye />}
                          >
                            {selectedItems.size === filteredContent.length ? 'Deselect All' : 'Select All'}
                          </Button>
                        )}
                      </HStack>
                      <Badge colorScheme={isMonitoring ? 'green' : 'gray'}>
                        {isMonitoring ? 'Live' : 'Paused'}
                      </Badge>
                    </HStack>
                  </CardHeader>
                  <CardBody>
                    {filteredContent.length === 0 ? (
                      <VStack spacing={4} py={12} textAlign="center">
                        <Icon as={FaEye} boxSize={12} color="gray.300" />
                        <VStack spacing={2}>
                          <Text fontSize="lg" fontWeight="bold" color="gray.500">
                            No Content Available
                          </Text>
                          <Text color="gray.400" maxW="400px">
                            {realContent.length === 0 
                              ? "Connect to social media platforms and load content to start monitoring."
                              : "No content matches your current filters. Try adjusting the filters above."
                            }
                          </Text>
                          {realContent.length === 0 && (
                            <Button
                              colorScheme="blue"
                              variant="outline"
                              onClick={loadRealContent}
                              isLoading={isLoadingContent}
                              loadingText="Loading..."
                              mt={4}
                            >
                              Load Content from Connected Platforms
                            </Button>
                          )}
                        </VStack>
                      </VStack>
                    ) : (
                      <VStack spacing={6} align="stretch">
                        {filteredContent.map((item) => {
                          const originalContent = realContent.find(c => c.id === item.id);
                          const hasReplies = originalContent?.replies && originalContent.replies.length > 0;
                          
                          return (
                            <Card key={item.id} variant="outline" bg={hasReplies ? "blue.50" : "white"}>
                              <CardBody>
                                <VStack spacing={4} align="stretch">
                                  {/* Selection Checkbox */}
                                  <HStack justify="space-between" align="center">
                                    <HStack spacing={3}>
                                      <input
                                        type="checkbox"
                                        checked={selectedItems.has(item.id)}
                                        onChange={() => handleSelectItem(item.id)}
                                        style={{ transform: 'scale(1.2)' }}
                                      />
                                      <Text fontSize="sm" color="gray.600">
                                        Select for bulk action
                                      </Text>
                                    </HStack>
                                    <Text fontSize="xs" color="gray.400">
                                      {item.timestamp.toLocaleString()}
                                    </Text>
                                  </HStack>

                                  {/* Original Tweet - Compact Header */}
                                  <Box p={3} bg="gray.100" borderRadius="md" border="1px solid" borderColor="gray.300">
                                    <HStack justify="space-between" align="flex-start">
                                      <VStack align="stretch" spacing={2} flex={1}>
                                        <HStack spacing={3} flexWrap="wrap">
                                          <Badge colorScheme="twitter" variant="solid">
                                            📱 YOUR TWEET
                                          </Badge>
                                          <Text fontSize="sm" color="gray.600" fontWeight="medium">
                                            @{item.author}
                                          </Text>
                                          <HStack spacing={2} fontSize="xs" color="gray.500">
                                            <Text>❤️ {originalContent?.engagement?.likes || 0}</Text>
                                            <Text>🔄 {originalContent?.engagement?.shares || 0}</Text>
                                            <Text>💬 {originalContent?.replies?.length || 0}</Text>
                                          </HStack>
                                        </HStack>
                                        
                                        <Text fontSize="sm" color="gray.700" fontStyle="italic">
                                          "{item.content}"
                                        </Text>
                                      </VStack>
                                    </HStack>
                                  </Box>

                                  {/* Replies Section - MAIN FOCUS */}
                                  {hasReplies ? (
                                    <Box>
                                      <HStack justify="space-between" align="center" mb={4}>
                                        <Text fontSize="lg" fontWeight="bold" color="red.600">
                                          🚨 REPLIES TO MODERATE ({originalContent.replies.length})
                                        </Text>
                                        <Badge colorScheme="red" variant="solid" fontSize="sm">
                                          NEEDS ATTENTION
                                        </Badge>
                                      </HStack>
                                      
                                      <VStack spacing={4} align="stretch">
                                        {originalContent.replies.map((reply, index) => (
                                          <Card key={reply.id} variant="solid" bg="white" border="2px solid" borderColor="orange.200">
                                            <CardBody p={4}>
                                              <HStack justify="space-between" align="flex-start" spacing={4}>
                                                <VStack align="stretch" spacing={3} flex={1}>
                                                  {/* Reply Header */}
                                                  <HStack justify="space-between" align="center">
                                                    <HStack spacing={3}>
                                                      <Badge colorScheme="orange" variant="outline">
                                                        REPLY #{index + 1}
                                                      </Badge>
                                                      <HStack spacing={2}>
                                                        <Text fontSize="md" fontWeight="bold" color="gray.800">
                                                          {reply.author.name}
                                                        </Text>
                                                        <Text fontSize="sm" color="gray.500">
                                                          @{reply.author.username}
                                                        </Text>
                                                        {reply.author.verified && (
                                                          <Icon as={FaCheck} color="blue.500" boxSize={4} />
                                                        )}
                                                      </HStack>
                                                    </HStack>
                                                    
                                                    <HStack spacing={2} fontSize="xs" color="gray.500">
                                                      <Text>❤️ {reply.engagement.likes || 0}</Text>
                                                      <Text>🔄 {reply.engagement.retweets || 0}</Text>
                                                      <Text>💬 {reply.engagement.replies || 0}</Text>
                                                    </HStack>
                                                  </HStack>
                                                  
                                                  {/* Reply Content */}
                                                  <Box p={3} bg="gray.50" borderRadius="md" borderLeft="4px solid" borderLeftColor="blue.400">
                                                    <Text fontSize="md" color="gray.800">
                                                      {reply.content}
                                                    </Text>
                                                  </Box>
                                                  
                                                  {/* Context: Replying to */}
                                                  <Text fontSize="xs" color="gray.500" fontStyle="italic">
                                                    💬 Replying to your tweet: "{item.content.substring(0, 50)}..."
                                                  </Text>
                                                  
                                                  {/* Reply Text */}
                                                  <Text fontSize="sm" mt={2} p={2} bg="gray.50" borderRadius="md">
                                                    "{reply.content}"
                                                  </Text>
                                                </VStack>
                                                
                                                {/* REPLY & MODERATION ACTIONS */}
                                                <VStack spacing={3} minW="140px">
                                                  <Text fontSize="xs" fontWeight="bold" color="blue.600" textAlign="center">
                                                    REPLY
                                                  </Text>
                                                  
                                                  <Button 
                                                    size="sm" 
                                                    colorScheme="blue" 
                                                    variant="solid"
                                                    onClick={() => setReplyingToTweet(reply.id)}
                                                    w="full"
                                                    leftIcon={<Icon as={FaReply} />}
                                                  >
                                                    Reply
                                                  </Button>
                                                  
                                                  <Text fontSize="xs" fontWeight="bold" color="gray.600" textAlign="center">
                                                    MODERATE
                                                  </Text>
                                                  
                                                  <VStack spacing={2} w="full">
                                                    <Tooltip label="Hide this reply from your app view only">
                                                      <Button
                                                        size="sm"
                                                        colorScheme="red"
                                                        variant="outline"
                                                        onClick={() => handleModerationAction('hide', reply.id, reply.author.id)}
                                                        w="full"
                                                        leftIcon={<Icon as={FaEyeSlash} />}
                                                      >
                                                        Hide
                                                      </Button>
                                                    </Tooltip>
                                                    
                                                    <Tooltip label="Mute this user from your app view (not Twitter)">
                                                      <Button
                                                        size="sm"
                                                        colorScheme="orange"
                                                        variant="outline"
                                                        onClick={() => handleModerationAction('mute', reply.id, reply.author.id)}
                                                        w="full"
                                                        leftIcon={<Icon as={FaVolumeMute} />}
                                                      >
                                                        Mute
                                                      </Button>
                                                    </Tooltip>
                                                    
                                                    <Tooltip label="Block user from app + get Twitter block link">
                                                      <Button
                                                        size="sm"
                                                        colorScheme="red"
                                                        onClick={() => handleModerationAction('block', reply.id, reply.author.id)}
                                                        w="full"
                                                        leftIcon={<Icon as={FaBan} />}
                                                      >
                                                        Block
                                                      </Button>
                                                    </Tooltip>
                                                  </VStack>
                                                </VStack>
                                              </HStack>
                                            </CardBody>
                                          </Card>
                                        ))}
                                      </VStack>
                                    </Box>
                                  ) : (
                                    <Box textAlign="center" py={4} color="gray.500">
                                      <Icon as={FaCheck} color="green.500" boxSize={6} mb={2} />
                                      <Text fontSize="sm">No replies to moderate</Text>
                                    </Box>
                                  )}
                                </VStack>
                              </CardBody>
                            </Card>
                          );
                        })}
                      </VStack>
                    )}
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>

            {/* AI Filtering Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                {/* AI Analysis Overview */}
                <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4}>
                  <Card>
                    <CardBody>
                      <Stat>
                        <StatLabel>Total Content Analyzed</StatLabel>
                        <StatNumber>{allContent.length}</StatNumber>
                        <StatHelpText>Posts and replies</StatHelpText>
                      </Stat>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody>
                      <Stat>
                        <StatLabel>Flagged by AI</StatLabel>
                        <StatNumber color="red.500">{allContent.filter(item => item.status === 'flagged').length}</StatNumber>
                        <StatHelpText>Requires attention</StatHelpText>
                      </Stat>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody>
                      <Stat>
                        <StatLabel>Average AI Confidence</StatLabel>
                        <StatNumber color="green.500">
                          {allContent.length > 0 ? Math.round(allContent.reduce((sum, item) => sum + item.aiConfidence, 0) / allContent.length) : 0}%
                        </StatNumber>
                        <StatHelpText>Analysis accuracy</StatHelpText>
                      </Stat>
                    </CardBody>
                  </Card>
                </Grid>

                {/* Content Categories */}
                <Card>
                  <CardHeader>
                    <Text fontSize="lg" fontWeight="bold">Content Categories</Text>
                  </CardHeader>
                  <CardBody>
                    <Grid templateColumns="repeat(auto-fit, minmax(150px, 1fr))" gap={4}>
                      {Object.entries(
                        allContent.reduce((acc, item) => {
                          acc[item.category] = (acc[item.category] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).map(([category, count]) => (
                        <Card key={category} variant="outline">
                          <CardBody p={3} textAlign="center">
                            <Text fontWeight="bold" fontSize="lg">{count}</Text>
                            <Text fontSize="sm" color="gray.600">{category}</Text>
                          </CardBody>
                        </Card>
                      ))}
                    </Grid>
                  </CardBody>
                </Card>

                {/* Flagged Content */}
                <Card>
                  <CardHeader>
                    <Text fontSize="lg" fontWeight="bold">Flagged Content ({allContent.filter(item => item.status === 'flagged').length})</Text>
                  </CardHeader>
                  <CardBody>
                    {allContent.filter(item => item.status === 'flagged').length === 0 ? (
                      <Text color="gray.500" textAlign="center" py={4}>
                        No flagged content found. AI analysis shows all content is within acceptable parameters.
                      </Text>
                    ) : (
                      <VStack spacing={3} align="stretch">
                        {allContent.filter(item => item.status === 'flagged').slice(0, 10).map((item) => (
                          <Card key={item.id} variant="outline" borderColor="red.200">
                            <CardBody>
                              <HStack justify="space-between" align="start">
                                <VStack align="start" spacing={2} flex={1}>
                                  <HStack spacing={2}>
                                    <Badge colorScheme={getSeverityColor(item.severity)}>
                                      {item.severity}
                                    </Badge>
                                    <Badge variant="outline">{item.category}</Badge>
                                    <Badge colorScheme="blue">{item.platform}</Badge>
                                  </HStack>
                                  <Text fontSize="sm" noOfLines={2}>
                                    {item.content}
                                  </Text>
                                  <Text fontSize="xs" color="gray.500">
                                    By {item.author} • AI Confidence: {item.aiConfidence}%
                                  </Text>
                                </VStack>
                                <VStack spacing={1}>
                                  <Button size="xs" colorScheme="green" onClick={() => handleContentAction(item.id, 'approve')}>
                                    Approve
                                  </Button>
                                  <Button size="xs" colorScheme="red" onClick={() => handleContentAction(item.id, 'reject')}>
                                    Reject
                                  </Button>
                                </VStack>
                              </HStack>
                            </CardBody>
                          </Card>
                        ))}
                      </VStack>
                    )}
                  </CardBody>
                </Card>

                <HStack justify="space-between">
                  <Text fontSize="lg" fontWeight="bold">Moderation Rules</Text>
                  <Button
                    leftIcon={<Icon as={FaFilter} />}
                    colorScheme="purple"
                    onClick={onRuleModalOpen}
                  >
                    Create Rule
                  </Button>
                </HStack>

                <Grid templateColumns="repeat(auto-fill, minmax(350px, 1fr))" gap={4}>
                  {moderationRules.map((rule) => (
                    <Card key={rule.id} variant={rule.enabled ? "elevated" : "outline"} opacity={rule.enabled ? 1 : 0.7}>
                      <CardHeader>
                        <HStack justify="space-between">
                          <VStack align="start" spacing={1}>
                            <HStack spacing={2}>
                              <Text fontWeight="bold">{rule.name}</Text>
                              {!rule.enabled && (
                                <Badge colorScheme="gray" size="sm">Disabled</Badge>
                              )}
                            </HStack>
                            <Badge colorScheme={getSeverityColor(rule.severity)}>
                              {rule.severity}
                            </Badge>
                          </VStack>
                          <HStack spacing={2}>
                            <Switch 
                              isChecked={rule.enabled} 
                              onChange={() => handleToggleRule(rule.id)}
                              colorScheme="green"
                            />
                            <Button
                              size="xs"
                              colorScheme="red"
                              variant="ghost"
                              onClick={() => handleDeleteRule(rule.id)}
                              title="Delete rule"
                            >
                              🗑️
                            </Button>
                          </HStack>
                        </HStack>
                      </CardHeader>
                      <CardBody>
                        <VStack align="start" spacing={3}>
                          <Text fontSize="sm" color="gray.600">
                            {rule.description}
                          </Text>
                          <HStack>
                            <Text fontSize="xs" fontWeight="bold">Category:</Text>
                            <Badge size="sm">{rule.category}</Badge>
                          </HStack>
                          <HStack>
                            <Text fontSize="xs" fontWeight="bold">Action:</Text>
                            <Badge size="sm" colorScheme="blue">{rule.action}</Badge>
                          </HStack>
                          {rule.keywords.length > 0 && (
                            <Box>
                              <Text fontSize="xs" fontWeight="bold" mb={1}>Keywords ({rule.keywords.length}):</Text>
                              <Wrap>
                                {rule.keywords.slice(0, 5).map((keyword, index) => (
                                  <WrapItem key={index}>
                                    <Tag size="sm" colorScheme="gray">
                                      <TagLabel>{keyword}</TagLabel>
                                    </Tag>
                                  </WrapItem>
                                ))}
                                {rule.keywords.length > 5 && (
                                  <WrapItem>
                                    <Tag size="sm" colorScheme="gray">
                                      <TagLabel>+{rule.keywords.length - 5} more</TagLabel>
                                    </Tag>
                                  </WrapItem>
                                )}
                              </Wrap>
                            </Box>
                          )}
                        </VStack>
                      </CardBody>
                    </Card>
                  ))}
                </Grid>
              </VStack>
            </TabPanel>

            {/* Platforms Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <HStack justify="space-between" align="center">
                  <Text fontSize="lg" fontWeight="bold">Platform Integration</Text>
                  <Button
                    size="sm"
                    colorScheme="purple"
                    variant="outline"
                    onClick={loadRealContent}
                    isLoading={isLoadingContent}
                    loadingText="Syncing..."
                  >
                    Sync All Platforms
                  </Button>
                </HStack>

                <Alert status="info">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Setup Required!</AlertTitle>
                    <AlertDescription>
                      To connect platforms, you need to set up API credentials. 
                      Copy the <code>env.example</code> file to <code>.env</code> and add your API keys.
                      <br />
                      <Text mt={2} fontSize="sm">
                        📖 <strong>Setup Guide:</strong> Check the SOCIAL_MEDIA_SETUP.md file for detailed instructions.
                      </Text>
                      <Text mt={1} fontSize="xs" color="orange.600">
                        ⚠️ <strong>Important:</strong> Use <code>VITE_</code> prefix for environment variables (not REACT_APP_)
                      </Text>
                    </AlertDescription>
                  </Box>
                </Alert>
                
                <Grid templateColumns="repeat(auto-fill, minmax(300px, 1fr))" gap={4}>
                  {platforms.map((platform) => (
                    <Card key={platform.id}>
                      <CardHeader>
                        <HStack justify="space-between">
                          <HStack>
                            <Icon as={platform.icon} color="blue.500" boxSize={6} />
                            <Text fontWeight="bold">{platform.name}</Text>
                          </HStack>
                          <Switch isChecked={platform.enabled} />
                        </HStack>
                      </CardHeader>
                      <CardBody>
                        <VStack align="start" spacing={3}>
                          <HStack>
                            <Text fontSize="sm" fontWeight="bold">Status:</Text>
                            <Badge colorScheme={platform.connected ? 'green' : 'red'}>
                              {platform.connected ? 'Connected' : 'Disconnected'}
                            </Badge>
                          </HStack>
                          {platform.connected && platform.userName && (
                            <HStack>
                              <Text fontSize="sm" fontWeight="bold">User:</Text>
                              <Text fontSize="sm">{platform.userName}</Text>
                            </HStack>
                          )}
                          <HStack>
                            <Text fontSize="sm" fontWeight="bold">Items Processed:</Text>
                            <Text fontSize="sm">{platform.itemsProcessed.toLocaleString()}</Text>
                          </HStack>
                          <HStack>
                            <Text fontSize="sm" fontWeight="bold">Last Sync:</Text>
                            <Text fontSize="sm">{platform.lastSync.toLocaleTimeString()}</Text>
                          </HStack>
                          
                          <VStack spacing={2} width="full">
                            {platform.connected ? (
                              <>
                                <Button 
                                  size="sm" 
                                  colorScheme="green" 
                                  variant="outline" 
                                  width="full"
                                  onClick={() => testPlatformConnection(platform.id)}
                                >
                                  Test Connection
                                </Button>
                                <Button 
                                  size="sm" 
                                  colorScheme="red" 
                                  variant="outline" 
                                  width="full"
                                  onClick={() => disconnectPlatform(platform.id)}
                                >
                                  Disconnect
                                </Button>
                              </>
                            ) : (
                              <Button 
                                size="sm" 
                                colorScheme="blue" 
                                width="full"
                                onClick={() => connectPlatform(platform.id)}
                                isLoading={platform.connecting}
                                loadingText="Connecting..."
                                isDisabled={!platform.enabled}
                              >
                                Connect
                              </Button>
                            )}
                          </VStack>
                        </VStack>
                      </CardBody>
                    </Card>
                  ))}
                </Grid>
              </VStack>
            </TabPanel>

            {/* User Management Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Text fontSize="lg" fontWeight="bold">User Management & Permissions</Text>
                
                <Alert status="info">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Role-based Access Control</AlertTitle>
                    <AlertDescription>
                      Manage user permissions and collaboration between moderation teams.
                    </AlertDescription>
                  </Box>
                </Alert>

                <Grid templateColumns="repeat(auto-fill, minmax(250px, 1fr))" gap={4}>
                  <Card>
                    <CardHeader>
                      <Text fontWeight="bold">Administrator</Text>
                    </CardHeader>
                    <CardBody>
                      <VStack align="start" spacing={2}>
                        <Text fontSize="sm">Full system access</Text>
                        <Badge colorScheme="red">3 users</Badge>
                      </VStack>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <Text fontWeight="bold">Senior Moderator</Text>
                    </CardHeader>
                    <CardBody>
                      <VStack align="start" spacing={2}>
                        <Text fontSize="sm">Advanced moderation tools</Text>
                        <Badge colorScheme="orange">8 users</Badge>
                      </VStack>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <Text fontWeight="bold">Moderator</Text>
                    </CardHeader>
                    <CardBody>
                      <VStack align="start" spacing={2}>
                        <Text fontSize="sm">Basic moderation access</Text>
                        <Badge colorScheme="blue">15 users</Badge>
                      </VStack>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <Text fontWeight="bold">Viewer</Text>
                    </CardHeader>
                    <CardBody>
                      <VStack align="start" spacing={2}>
                        <Text fontSize="sm">Read-only access</Text>
                        <Badge colorScheme="gray">5 users</Badge>
                      </VStack>
                    </CardBody>
                  </Card>
                </Grid>
              </VStack>
            </TabPanel>

            {/* Analytics Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Text fontSize="lg" fontWeight="bold">Moderation Analytics & Insights</Text>
                
                <Grid templateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap={4}>
                  <Card>
                    <CardHeader>
                      <Text fontWeight="bold">Content Trends</Text>
                    </CardHeader>
                    <CardBody>
                      <VStack spacing={3}>
                        <Box w="full">
                          <HStack justify="space-between">
                            <Text fontSize="sm">Hate Speech</Text>
                            <Text fontSize="sm">12%</Text>
                          </HStack>
                          <Progress value={12} colorScheme="red" size="sm" />
                        </Box>
                        <Box w="full">
                          <HStack justify="space-between">
                            <Text fontSize="sm">Spam</Text>
                            <Text fontSize="sm">35%</Text>
                          </HStack>
                          <Progress value={35} colorScheme="orange" size="sm" />
                        </Box>
                        <Box w="full">
                          <HStack justify="space-between">
                            <Text fontSize="sm">Misinformation</Text>
                            <Text fontSize="sm">8%</Text>
                          </HStack>
                          <Progress value={8} colorScheme="yellow" size="sm" />
                        </Box>
                      </VStack>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <Text fontWeight="bold">Platform Performance</Text>
                    </CardHeader>
                    <CardBody>
                      <VStack spacing={3}>
                        <HStack justify="space-between" w="full">
                          <Text fontSize="sm">Facebook</Text>
                          <Badge colorScheme="green">98.5%</Badge>
                        </HStack>
                        <HStack justify="space-between" w="full">
                          <Text fontSize="sm">Twitter</Text>
                          <Badge colorScheme="green">97.2%</Badge>
                        </HStack>
                        <HStack justify="space-between" w="full">
                          <Text fontSize="sm">Instagram</Text>
                          <Badge colorScheme="yellow">94.8%</Badge>
                        </HStack>
                      </VStack>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <Text fontWeight="bold">Response Times</Text>
                    </CardHeader>
                    <CardBody>
                      <VStack spacing={3}>
                        <HStack justify="space-between" w="full">
                          <Text fontSize="sm">Average</Text>
                          <Text fontSize="sm" fontWeight="bold">2.3s</Text>
                        </HStack>
                        <HStack justify="space-between" w="full">
                          <Text fontSize="sm">Peak</Text>
                          <Text fontSize="sm">4.7s</Text>
                        </HStack>
                        <HStack justify="space-between" w="full">
                          <Text fontSize="sm">Best</Text>
                          <Text fontSize="sm">0.8s</Text>
                        </HStack>
                      </VStack>
                    </CardBody>
                  </Card>
                </Grid>

                <Card>
                  <CardHeader>
                    <Text fontWeight="bold">iCloud Sync Status</Text>
                  </CardHeader>
                  <CardBody>
                    <HStack spacing={4}>
                      <Icon as={FaCloud} color="blue.500" boxSize={8} />
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="bold" color="green.500">✅ Synchronized</Text>
                        <Text fontSize="sm" color="gray.600">
                          All moderation data is synced to iCloud. Last backup: {new Date().toLocaleString()}
                        </Text>
                        <HStack spacing={2}>
                          <Badge colorScheme="blue">2.3 GB stored</Badge>
                          <Badge colorScheme="green">Auto-backup enabled</Badge>
                        </HStack>
                      </VStack>
                    </HStack>
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>

            {/* Settings Tab */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                <Text fontSize="lg" fontWeight="bold">Moderation Settings</Text>
                
                <Card>
                  <CardHeader>
                    <Text fontWeight="bold">AI Configuration</Text>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={4} align="stretch">
                      <FormControl>
                        <FormLabel>AI Sensitivity Level</FormLabel>
                        <Slider defaultValue={75} min={0} max={100}>
                          <SliderTrack>
                            <SliderFilledTrack />
                          </SliderTrack>
                          <SliderThumb />
                        </Slider>
                        <Text fontSize="sm" color="gray.600" mt={1}>
                          Higher sensitivity catches more potential issues but may increase false positives
                        </Text>
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Auto-approve low-risk content</FormLabel>
                        <Switch />
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Enable machine learning improvements</FormLabel>
                        <Switch defaultChecked />
                      </FormControl>
                    </VStack>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <Text fontWeight="bold">Notification Preferences</Text>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={4} align="stretch">
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Email notifications for critical content</FormLabel>
                        <Switch defaultChecked />
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Push notifications</FormLabel>
                        <Switch defaultChecked />
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Daily summary reports</FormLabel>
                        <Switch />
                      </FormControl>
                    </VStack>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <Text fontWeight="bold">iCloud Integration</Text>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={4} align="stretch">
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Enable iCloud sync</FormLabel>
                        <Switch defaultChecked />
                      </FormControl>
                      
                      <FormControl>
                        <FormLabel>Backup frequency</FormLabel>
                        <Select defaultValue="hourly">
                          <option value="realtime">Real-time</option>
                          <option value="hourly">Every hour</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                        </Select>
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Cross-device synchronization</FormLabel>
                        <Switch defaultChecked />
                      </FormControl>
                      
                      <Alert status="info" size="sm">
                        <AlertIcon />
                        Your data is encrypted and securely stored in iCloud for access across all your devices.
                      </Alert>
                    </VStack>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <Text fontWeight="bold">Regional Compliance</Text>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={4} align="stretch">
                      <FormControl>
                        <FormLabel>Primary jurisdiction</FormLabel>
                        <Select defaultValue="us">
                          <option value="us">United States (CCPA)</option>
                          <option value="eu">European Union (GDPR)</option>
                          <option value="uk">United Kingdom (UK GDPR)</option>
                          <option value="ca">Canada (PIPEDA)</option>
                          <option value="au">Australia (Privacy Act)</option>
                        </Select>
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Enable data retention policies</FormLabel>
                        <Switch defaultChecked />
                      </FormControl>
                      
                      <FormControl>
                        <FormLabel>Data retention period (days)</FormLabel>
                        <NumberInput defaultValue={365} min={30} max={2555}>
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                      </FormControl>
                    </VStack>
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>

        {/* Content Detail Modal */}
        <Modal isOpen={isContentModalOpen} onClose={onContentModalClose} size="xl">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Content Details</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {selectedContent && (
                <VStack spacing={4} align="stretch">
                  <HStack>
                    <Badge colorScheme="blue">{selectedContent.platform}</Badge>
                    <Badge colorScheme={getSeverityColor(selectedContent.severity)}>
                      {selectedContent.severity}
                    </Badge>
                    <Badge colorScheme={getStatusColor(selectedContent.status)}>
                      {selectedContent.status}
                    </Badge>
                  </HStack>
                  
                  <Box>
                    <Text fontWeight="bold" mb={2}>Content:</Text>
                    <Box p={3} bg="gray.50" borderRadius="md">
                      <Text>{selectedContent.content}</Text>
                    </Box>
                  </Box>
                  
                  <HStack justify="space-between">
                    <Text><strong>Author:</strong> {selectedContent.author}</Text>
                    <Text><strong>AI Confidence:</strong> {selectedContent.aiConfidence}%</Text>
                  </HStack>
                  
                  <Text><strong>Category:</strong> {selectedContent.category}</Text>
                  <Text><strong>Timestamp:</strong> {selectedContent.timestamp.toLocaleString()}</Text>
                </VStack>
              )}
            </ModalBody>
            <ModalFooter>
              <HStack spacing={3}>
                <Button
                  colorScheme="green"
                  onClick={() => {
                    if (selectedContent) {
                      handleContentAction(selectedContent.id, 'approve');
                    }
                    onContentModalClose();
                  }}
                >
                  Approve
                </Button>
                <Button
                  colorScheme="red"
                  onClick={() => {
                    if (selectedContent) {
                      handleContentAction(selectedContent.id, 'reject');
                    }
                    onContentModalClose();
                  }}
                >
                  Reject
                </Button>
                <Button variant="ghost" onClick={onContentModalClose}>
                  Close
                </Button>
              </HStack>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Create Rule Modal */}
        <Modal isOpen={isRuleModalOpen} onClose={onRuleModalClose} size="lg">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Create Moderation Rule</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack spacing={4} align="stretch">
                <FormControl isRequired>
                  <FormLabel>Rule Name</FormLabel>
                  <Input
                    value={newRule.name || ''}
                    onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter rule name"
                  />
                </FormControl>
                
                <FormControl isRequired>
                  <FormLabel>Description</FormLabel>
                  <Textarea
                    value={newRule.description || ''}
                    onChange={(e) => setNewRule(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what this rule does"
                  />
                </FormControl>
                
                <HStack spacing={4}>
                  <FormControl>
                    <FormLabel>Category</FormLabel>
                    <Select
                      value={newRule.category || ''}
                      onChange={(e) => setNewRule(prev => ({ ...prev, category: e.target.value }))}
                    >
                      <option value="">Select category</option>
                      <option value="Safety">Safety</option>
                      <option value="Quality">Quality</option>
                      <option value="Legal">Legal</option>
                      <option value="Custom">Custom</option>
                    </Select>
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>Severity</FormLabel>
                    <Select
                      value={newRule.severity || ''}
                      onChange={(e) => setNewRule(prev => ({ ...prev, severity: e.target.value as any }))}
                    >
                      <option value="">Select severity</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </Select>
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>Action</FormLabel>
                    <Select
                      value={newRule.action || ''}
                      onChange={(e) => setNewRule(prev => ({ ...prev, action: e.target.value as any }))}
                    >
                      <option value="">Select action</option>
                      <option value="flag">Flag for review</option>
                      <option value="block">Auto-block</option>
                      <option value="review">Manual review</option>
                      <option value="auto-approve">Auto-approve</option>
                    </Select>
                  </FormControl>
                </HStack>
                
                <FormControl>
                  <FormLabel>Keywords - Supports Arabic & All Languages</FormLabel>
                  <Textarea
                    value={newRule.keywordText || ''}
                    onChange={(e) => {
                      const text = e.target.value;
                      // Support multiple separators: comma, semicolon, pipe, newline, space
                      const separators = /[,،;|؛\n\r]+/;
                      const keywords = text
                        .split(separators)
                        .map(k => k.trim())
                        .filter(k => k && k.length > 0);
                      
                      setNewRule(prev => ({ 
                        ...prev, 
                        keywordText: text,
                        keywords: keywords
                      }));
                    }}
                    placeholder="Multiple ways to separate keywords:

✅ Comma: spam, scam, hate
✅ Arabic comma: نصب، احتيال، كراهية  
✅ Semicolon: spam; scam; hate
✅ Arabic semicolon: نصب؛ احتيال؛ كراهية
✅ Pipe: spam | scam | hate
✅ New lines: 
spam
scam  
hate
نصب
احتيال
✅ Spaces: spam scam hate نصب احتيال

Examples:
English: spam, scam, hate, fraud, harassment, bullying, threat, violence, discrimination, offensive, inappropriate, toxic, troll, fake news, misinformation, bitcoin, investment, crypto

Arabic: نصب، احتيال، كراهية، غبي، أحمق، مضايقة، تنمر، تهديد، تمييز، عنصري، سب، شتم، بيتكوين، استثمار، ربح سريع، مال مجاني، اضغط هنا، وقت محدود، عرض خاص، حصري، مجاني

Mix: spam | نصب | hate | كراهية | scam | احتيال"
                    rows={8}
                    resize="vertical"
                    dir="auto"
                    style={{ 
                      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", "Noto Sans Arabic", "Arabic UI Text"',
                      lineHeight: '1.6'
                    }}
                  />
                  <HStack spacing={2} mt={2} wrap="wrap">
                    <Text fontSize="xs" color="gray.500">
                      Quick separators:
                    </Text>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        const currentText = newRule.keywordText || '';
                        const newText = currentText + (currentText ? ', ' : '') + '';
                        
                        const separators = /[,،;|؛\n\r]+/;
                        const keywords = newText
                          .split(separators)
                          .map(k => k.trim())
                          .filter(k => k && k.length > 0);
                        
                        setNewRule(prev => ({ 
                          ...prev, 
                          keywordText: newText,
                          keywords: keywords
                        }));
                      }}
                    >
                      , (comma)
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        const currentText = newRule.keywordText || '';
                        const newText = currentText + (currentText ? '، ' : '') + '';
                        
                        const separators = /[,،;|؛\n\r]+/;
                        const keywords = newText
                          .split(separators)
                          .map(k => k.trim())
                          .filter(k => k && k.length > 0);
                        
                        setNewRule(prev => ({ 
                          ...prev, 
                          keywordText: newText,
                          keywords: keywords
                        }));
                      }}
                    >
                      ، (Arabic comma)
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        const currentText = newRule.keywordText || '';
                        const newText = currentText + (currentText ? ' | ' : '') + '';
                        
                        const separators = /[,،;|؛\n\r]+/;
                        const keywords = newText
                          .split(separators)
                          .map(k => k.trim())
                          .filter(k => k && k.length > 0);
                        
                        setNewRule(prev => ({ 
                          ...prev, 
                          keywordText: newText,
                          keywords: keywords
                        }));
                      }}
                    >
                      | (pipe)
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        const currentText = newRule.keywordText || '';
                        const newText = currentText + (currentText ? '\n' : '') + '';
                        
                        const separators = /[,،;|؛\n\r]+/;
                        const keywords = newText
                          .split(separators)
                          .map(k => k.trim())
                          .filter(k => k && k.length > 0);
                        
                        setNewRule(prev => ({ 
                          ...prev, 
                          keywordText: newText,
                          keywords: keywords
                        }));
                      }}
                    >
                      ↵ (new line)
                    </Button>
                  </HStack>
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    ✅ Use ANY separator or click buttons above • Current count: {newRule.keywords?.length || 0} keywords
                  </Text>
                  {newRule.keywords && newRule.keywords.length > 0 && (
                    <Box mt={2}>
                      <Text fontSize="xs" fontWeight="bold" mb={1}>Preview Keywords:</Text>
                      <Wrap>
                        {newRule.keywords.slice(0, 10).map((keyword, index) => (
                          <WrapItem key={index}>
                            <Tag size="sm" colorScheme="purple">
                              <TagLabel>{keyword}</TagLabel>
                            </Tag>
                          </WrapItem>
                        ))}
                        {newRule.keywords.length > 10 && (
                          <WrapItem>
                            <Tag size="sm" colorScheme="gray">
                              <TagLabel>+{newRule.keywords.length - 10} more</TagLabel>
                            </Tag>
                          </WrapItem>
                        )}
                      </Wrap>
                    </Box>
                  )}
                </FormControl>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <HStack spacing={3}>
                <Button colorScheme="purple" onClick={handleCreateRule}>
                  Create Rule
                </Button>
                <Button variant="ghost" onClick={onRuleModalClose}>
                  Cancel
                </Button>
              </HStack>
            </ModalFooter>
          </ModalContent>
        </Modal>
        
        {/* Reply Modal */}
        {replyingToTweet && (
          <Box 
            position="fixed" 
            top="0" 
            left="0" 
            right="0" 
            bottom="0" 
            bg="blackAlpha.600" 
            zIndex="overlay"
            display="flex"
            alignItems="center"
            justifyContent="center"
            onClick={() => setReplyingToTweet(null)}
          >
            <Box 
              bg="white" 
              p={6} 
              borderRadius="lg" 
              maxW="500px" 
              w="90%"
              onClick={(e) => e.stopPropagation()}
            >
              <VStack spacing={4} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="lg" fontWeight="bold">Reply to Tweet</Text>
                  <Button size="sm" variant="ghost" onClick={() => setReplyingToTweet(null)}>
                    ✕
                  </Button>
                </HStack>
                
                <Textarea
                  placeholder="Write your reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                  resize="vertical"
                />
                
                <HStack justify="space-between">
                  <Text fontSize="sm" color="gray.500">
                    {replyText.length}/280 characters
                  </Text>
                  <HStack>
                    <Button 
                      variant="outline" 
                      onClick={() => setReplyingToTweet(null)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      colorScheme="blue" 
                      onClick={() => handleReplyToTweet(replyingToTweet)}
                      isLoading={isPostingReply}
                      isDisabled={!replyText.trim() || replyText.length > 280}
                    >
                      Post Reply
                    </Button>
                  </HStack>
                </HStack>
              </VStack>
            </Box>
          </Box>
        )}
      </VStack>
    </Box>
  );
};

export default SocialModerationSection;
