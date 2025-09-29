import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Card,
  CardBody,
  CardHeader,
  Textarea,
  Input,
  Select,
  Switch,
  FormControl,
  FormLabel,
  Image,
  IconButton,
  Badge,
  Flex,
  Spacer,
  Grid,
  GridItem,
  Alert,
  AlertIcon,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Checkbox,
  CheckboxGroup,
  Stack,
  Progress,
  Divider,
  Tag,
  TagLabel,
  TagCloseButton,
  Wrap,
  WrapItem,
  Avatar,
} from '@chakra-ui/react';
import {
  FaImage,
  FaVideo,
  FaCalendarAlt,
  FaHashtag,
  FaAt,
  FaLink,
  FaEye,
  FaTrash,
  FaEdit,
  FaCopy,
  FaShare,
  FaFacebook,
  FaInstagram,
  FaSnapchat,
  FaLinkedin,
  FaTiktok,
  FaTwitter,
  FaYoutube,
  FaPlus,
  FaClock,
  FaCheck,
  FaTimes,
  FaSpinner,
} from 'react-icons/fa';
import { platformAuth } from '../services/platformAuth';
import { socialPosting } from '../services/socialPosting';

interface PostContent {
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
}

interface SocialPostingTabProps {
  connectedPlatforms: string[];
}

const SocialPostingTab: React.FC<SocialPostingTabProps> = ({ connectedPlatforms }) => {
  const [posts, setPosts] = useState<PostContent[]>([]);
  const [currentPost, setCurrentPost] = useState<Partial<PostContent>>({
    text: '',
    mediaUrls: [],
    platforms: [],
    hashtags: [],
    mentions: [],
    status: 'draft',
  });
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [hashtagInput, setHashtagInput] = useState('');
  const [mentionInput, setMentionInput] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [previewMode, setPreviewMode] = useState<string>('facebook');
  
  const { isOpen: isPreviewOpen, onOpen: onPreviewOpen, onClose: onPreviewClose } = useDisclosure();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // Load posts from server
  useEffect(() => {
    const loadPosts = async () => {
      try {
        const response = await fetch('http://localhost:3002/api/posts/recent').catch(error => {
          console.error('❌ Network error when fetching recent posts:', error);
          throw new Error('Server is not running. Please start the server with: npm run server');
        });
        if (response.ok) {
          const serverPosts = await response.json();
          setPosts(serverPosts);
          console.log(`📊 Loaded ${serverPosts.length} posts from server`);
        } else {
          console.error('Failed to load posts from server');
        }
      } catch (error) {
        console.error('Error loading posts:', error);
      }
    };

    loadPosts();
  }, []);

  const platformIcons = {
    facebook: FaFacebook,
    instagram: FaInstagram,
    snapchat: FaSnapchat,
    linkedin: FaLinkedin,
    tiktok: FaTiktok,
    twitter: FaTwitter,
    youtube: FaYoutube,
  };

  const platformColors = {
    facebook: 'blue.500',
    instagram: 'pink.500',
    snapchat: 'yellow.400',
    linkedin: 'blue.600',
    tiktok: 'gray.800',
    twitter: 'blue.400',
    youtube: 'red.500',
  };

  const platformLimits = {
    facebook: { text: 63206, hashtags: 30 },
    instagram: { text: 2200, hashtags: 30 },
    linkedin: { text: 3000, hashtags: 10 },
    snapchat: { text: 250, hashtags: 10 },
    tiktok: { text: 300, hashtags: 20 },
    twitter: { text: 280, hashtags: 10 },
    youtube: { text: 5000, hashtags: 15 },
  };

  const handleMediaUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newMediaUrls: string[] = [];
    const maxFileSize = 5 * 1024 * 1024; // 5MB limit
    let hasLargeFiles = false;

    Array.from(files).forEach(file => {
      if (file.size > maxFileSize) {
        console.log(`📦 Large file detected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB) - will be compressed`);
        hasLargeFiles = true;
      }
      
      const url = URL.createObjectURL(file);
      newMediaUrls.push(url);
    });

    if (hasLargeFiles) {
      toast({
        title: 'Large files detected',
        description: 'Images larger than 5MB will be automatically compressed for Twitter.',
        status: 'info',
        duration: 4000,
        isClosable: true,
      });
    }

    setCurrentPost(prev => ({
      ...prev,
      mediaUrls: [...(prev.mediaUrls || []), ...newMediaUrls],
      mediaType: files[0].type.startsWith('video/') ? 'video' : 'image',
    }));
  };

  const removeMedia = (index: number) => {
    setCurrentPost(prev => ({
      ...prev,
      mediaUrls: prev.mediaUrls?.filter((_, i) => i !== index) || [],
    }));
  };

  const addHashtag = () => {
    if (hashtagInput.trim() && !currentPost.hashtags?.includes(hashtagInput.trim())) {
      setCurrentPost(prev => ({
        ...prev,
        hashtags: [...(prev.hashtags || []), hashtagInput.trim()],
      }));
      setHashtagInput('');
    }
  };

  const removeHashtag = (hashtag: string) => {
    setCurrentPost(prev => ({
      ...prev,
      hashtags: prev.hashtags?.filter(h => h !== hashtag) || [],
    }));
  };

  const addMention = () => {
    if (mentionInput.trim() && !currentPost.mentions?.includes(mentionInput.trim())) {
      setCurrentPost(prev => ({
        ...prev,
        mentions: [...(prev.mentions || []), mentionInput.trim()],
      }));
      setMentionInput('');
    }
  };

  const removeMention = (mention: string) => {
    setCurrentPost(prev => ({
      ...prev,
      mentions: prev.mentions?.filter(m => m !== mention) || [],
    }));
  };

  const getCharacterLimit = () => {
    if (selectedPlatforms.length === 0) return 280; // Default Twitter limit
    const combinedLimits = socialPosting.getCombinedLimits(selectedPlatforms);
    return combinedLimits.text;
  };

  const getCharacterCount = () => {
    const text = currentPost.text || '';
    const hashtags = currentPost.hashtags?.join(' #') || '';
    const mentions = currentPost.mentions?.join(' @') || '';
    return text.length + (hashtags ? hashtags.length + 1 : 0) + (mentions ? mentions.length + 1 : 0);
  };

  const isOverLimit = () => {
    if (selectedPlatforms.length === 0) return false;
    
    const validation = socialPosting.validatePost({
      text: currentPost.text || '',
      mediaUrls: currentPost.mediaUrls,
      hashtags: currentPost.hashtags,
      mentions: currentPost.mentions,
      platforms: selectedPlatforms,
      scheduledTime: isScheduled ? new Date(scheduledDateTime) : undefined,
    });
    
    return !validation.valid;
  };

  const publishPost = async () => {
    if (!currentPost.text?.trim() || selectedPlatforms.length === 0) {
      toast({
        title: 'Missing content',
        description: 'Please add text content and select at least one platform.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (isOverLimit()) {
      toast({
        title: 'Content too long',
        description: 'Please reduce the content length for the selected platforms.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsPublishing(true);

    try {
      const newPost: PostContent = {
        id: `post_${Date.now()}`,
        text: currentPost.text || '',
        mediaUrls: currentPost.mediaUrls || [],
        mediaType: currentPost.mediaType || null,
        platforms: selectedPlatforms,
        hashtags: currentPost.hashtags || [],
        mentions: currentPost.mentions || [],
        status: isScheduled ? 'scheduled' : 'publishing',
        createdAt: new Date(),
        scheduledTime: isScheduled ? new Date(scheduledDateTime) : undefined,
      };

      if (isScheduled) {
        // Schedule the post
        const result = await socialPosting.publishPost({
          text: currentPost.text || '',
          mediaUrls: currentPost.mediaUrls,
          hashtags: currentPost.hashtags,
          mentions: currentPost.mentions,
          platforms: selectedPlatforms,
          scheduledTime: new Date(scheduledDateTime)
        });
        setPosts(prev => [...prev, result]);
        toast({
          title: 'Post scheduled',
          description: `Your post will be published on ${new Date(scheduledDateTime).toLocaleString()}`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        // Publish immediately using socialPosting service
        try {
          // Check if user is trying to post media
          const hasMedia = currentPost.mediaUrls && currentPost.mediaUrls.length > 0;
          
          if (hasMedia && selectedPlatforms.includes('twitter')) {
            toast({
              title: 'Media upload temporarily disabled',
              description: 'Twitter media upload is being fixed. Text will be posted without media.',
              status: 'warning',
              duration: 5000,
              isClosable: true,
            });
          }

          const publishedPost = await socialPosting.publishPost({
            text: currentPost.text || '',
            mediaUrls: currentPost.mediaUrls,
            hashtags: currentPost.hashtags,
            mentions: currentPost.mentions,
            platforms: selectedPlatforms,
          });

          setPosts(prev => [...prev, publishedPost]);

          const successMessage = hasMedia && selectedPlatforms.includes('twitter') 
            ? `Published to ${selectedPlatforms.length} platform(s) (Twitter: text only)`
            : `Successfully published to ${selectedPlatforms.length} platform(s)`;

          toast({
            title: 'Post published',
            description: successMessage,
            status: 'success',
            duration: 3000,
            isClosable: true,
          });
        } catch (publishError: any) {
          toast({
            title: 'Publishing failed',
            description: publishError.message || 'Failed to publish post. Please try again.',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        }
      }

      // Reset form
      setCurrentPost({
        text: '',
        mediaUrls: [],
        platforms: [],
        hashtags: [],
        mentions: [],
        status: 'draft',
      });
      setSelectedPlatforms([]);
      setIsScheduled(false);
      setScheduledDateTime('');

    } catch (error) {
      toast({
        title: 'Publishing failed',
        description: 'Failed to publish post. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // Publishing is now handled by the socialPosting service

  const saveDraft = () => {
    const draft: PostContent = {
      id: `draft_${Date.now()}`,
      text: currentPost.text || '',
      mediaUrls: currentPost.mediaUrls || [],
      mediaType: currentPost.mediaType || null,
      platforms: selectedPlatforms,
      hashtags: currentPost.hashtags || [],
      mentions: currentPost.mentions || [],
      status: 'draft',
      createdAt: new Date(),
    };

    setPosts(prev => [...prev, draft]);
    toast({
      title: 'Draft saved',
      description: 'Your post has been saved as a draft.',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const loadDraft = (post: PostContent) => {
    setCurrentPost(post);
    setSelectedPlatforms(post.platforms);
    if (post.scheduledTime) {
      setIsScheduled(true);
      setScheduledDateTime(post.scheduledTime.toISOString().slice(0, 16));
    }
  };

  const deleteDraft = (postId: string) => {
    setPosts(prev => prev.filter(post => post.id !== postId));
    toast({
      title: 'Draft deleted',
      status: 'info',
      duration: 2000,
      isClosable: true,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'gray';
      case 'scheduled': return 'blue';
      case 'publishing': return 'yellow';
      case 'published': return 'green';
      case 'failed': return 'red';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return FaEdit;
      case 'scheduled': return FaClock;
      case 'publishing': return FaSpinner;
      case 'published': return FaCheck;
      case 'failed': return FaTimes;
      default: return FaEdit;
    }
  };

  return (
    <Grid templateColumns="2fr 1fr" gap={6} h="600px">
      {/* Post Composer */}
      <GridItem>
        <Card h="100%">
          <CardHeader>
            <HStack>
              <Text fontSize="lg" fontWeight="bold">Create Post</Text>
              <Spacer />
              <Button size="sm" variant="outline" onClick={saveDraft}>
                Save Draft
              </Button>
              <Button size="sm" variant="outline" onClick={onPreviewOpen}>
                <FaEye /> Preview
              </Button>
            </HStack>
          </CardHeader>
          
          <CardBody>
            <VStack spacing={4} align="stretch">
              {/* Platform Selection */}
              <FormControl>
                <FormLabel>Select Platforms</FormLabel>
                <CheckboxGroup
                  value={selectedPlatforms}
                  onChange={(values) => setSelectedPlatforms(values as string[])}
                >
                  <Wrap>
                    {connectedPlatforms.map(platform => {
                      const PlatformIcon = platformIcons[platform as keyof typeof platformIcons];
                      // Skip platforms without icons to prevent errors
                      if (!PlatformIcon) {
                        console.warn(`No icon found for platform: ${platform}`);
                        return null;
                      }
                      return (
                        <WrapItem key={platform}>
                          <Checkbox value={platform}>
                            <HStack spacing={2}>
                              <PlatformIcon 
                                color={platformColors[platform as keyof typeof platformColors]} 
                              />
                              <Text>{platform.charAt(0).toUpperCase() + platform.slice(1)}</Text>
                            </HStack>
                          </Checkbox>
                        </WrapItem>
                      );
                    })}
                  </Wrap>
                </CheckboxGroup>
              </FormControl>

              {/* Text Content */}
              <FormControl>
                <FormLabel>
                  <HStack>
                    <Text>Post Content</Text>
                    <Spacer />
                    <Text 
                      fontSize="sm" 
                      color={isOverLimit() ? 'red.500' : 'gray.500'}
                    >
                      {getCharacterCount()}/{getCharacterLimit()}
                    </Text>
                  </HStack>
                </FormLabel>
                <Textarea
                  placeholder="What's on your mind?"
                  value={currentPost.text}
                  onChange={(e) => setCurrentPost(prev => ({ ...prev, text: e.target.value }))}
                  rows={6}
                  resize="vertical"
                  isInvalid={isOverLimit()}
                />
                {isOverLimit() && (
                  <Text fontSize="sm" color="red.500" mt={1}>
                    Content exceeds character limit for selected platforms
                  </Text>
                )}
              </FormControl>

              {/* Media Upload */}
              <FormControl>
                <FormLabel>Media</FormLabel>
                <HStack>
                  <Button
                    leftIcon={<FaImage />}
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Add Media
                  </Button>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleMediaUpload}
                    display="none"
                  />
                </HStack>
                
                {currentPost.mediaUrls && currentPost.mediaUrls.length > 0 && (
                  <Grid templateColumns="repeat(auto-fill, minmax(100px, 1fr))" gap={2} mt={2}>
                    {currentPost.mediaUrls.map((url, index) => (
                      <Box key={index} position="relative">
                        <Image
                          src={url}
                          alt={`Media ${index + 1}`}
                          borderRadius="md"
                          objectFit="cover"
                          h="100px"
                          w="100%"
                        />
                        <IconButton
                          aria-label="Remove media"
                          icon={<FaTimes />}
                          size="xs"
                          position="absolute"
                          top={1}
                          right={1}
                          colorScheme="red"
                          onClick={() => removeMedia(index)}
                        />
                      </Box>
                    ))}
                  </Grid>
                )}
              </FormControl>

              {/* Hashtags */}
              <FormControl>
                <FormLabel>Hashtags</FormLabel>
                <HStack>
                  <Input
                    placeholder="Add hashtag (without #)"
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addHashtag()}
                    size="sm"
                  />
                  <Button size="sm" onClick={addHashtag} leftIcon={<FaHashtag />}>
                    Add
                  </Button>
                </HStack>
                
                {currentPost.hashtags && currentPost.hashtags.length > 0 && (
                  <Wrap mt={2}>
                    {currentPost.hashtags.map(hashtag => (
                      <WrapItem key={hashtag}>
                        <Tag size="sm" colorScheme="blue">
                          <TagLabel>#{hashtag}</TagLabel>
                          <TagCloseButton onClick={() => removeHashtag(hashtag)} />
                        </Tag>
                      </WrapItem>
                    ))}
                  </Wrap>
                )}
              </FormControl>

              {/* Mentions */}
              <FormControl>
                <FormLabel>Mentions</FormLabel>
                <HStack>
                  <Input
                    placeholder="Add mention (without @)"
                    value={mentionInput}
                    onChange={(e) => setMentionInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addMention()}
                    size="sm"
                  />
                  <Button size="sm" onClick={addMention} leftIcon={<FaAt />}>
                    Add
                  </Button>
                </HStack>
                
                {currentPost.mentions && currentPost.mentions.length > 0 && (
                  <Wrap mt={2}>
                    {currentPost.mentions.map(mention => (
                      <WrapItem key={mention}>
                        <Tag size="sm" colorScheme="green">
                          <TagLabel>@{mention}</TagLabel>
                          <TagCloseButton onClick={() => removeMention(mention)} />
                        </Tag>
                      </WrapItem>
                    ))}
                  </Wrap>
                )}
              </FormControl>

              {/* Scheduling */}
              <FormControl>
                <HStack>
                  <Switch
                    isChecked={isScheduled}
                    onChange={(e) => setIsScheduled(e.target.checked)}
                  />
                  <FormLabel mb={0}>Schedule for later</FormLabel>
                </HStack>
                
                {isScheduled && (
                  <Input
                    type="datetime-local"
                    value={scheduledDateTime}
                    onChange={(e) => setScheduledDateTime(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    mt={2}
                  />
                )}
              </FormControl>

              {/* Publish Button */}
              <Button
                colorScheme="blue"
                size="lg"
                onClick={publishPost}
                isLoading={isPublishing}
                loadingText={isScheduled ? "Scheduling..." : "Publishing..."}
                leftIcon={isScheduled ? <FaCalendarAlt /> : <FaShare />}
                isDisabled={!currentPost.text?.trim() || selectedPlatforms.length === 0 || isOverLimit()}
              >
                {isScheduled ? 'Schedule Post' : 'Publish Now'}
              </Button>
            </VStack>
          </CardBody>
        </Card>
      </GridItem>

      {/* Posts History */}
      <GridItem>
        <Card h="100%">
          <CardHeader>
            <Text fontSize="lg" fontWeight="bold">Recent Posts</Text>
          </CardHeader>
          
          <CardBody overflowY="auto">
            <VStack spacing={3} align="stretch">
              {posts.length === 0 ? (
                <Text color="gray.500" textAlign="center" py={8}>
                  No posts yet. Create your first post!
                </Text>
              ) : (
                posts.map(post => {
                  const StatusIcon = getStatusIcon(post.status);
                  return (
                    <Card key={post.id} size="sm" variant="outline">
                      <CardBody>
                        <VStack spacing={2} align="stretch">
                          <HStack>
                            <Badge 
                              colorScheme={getStatusColor(post.status)}
                              display="flex"
                              alignItems="center"
                              gap={1}
                            >
                              <StatusIcon size={12} />
                              {post.status}
                            </Badge>
                            <Spacer />
                            {post.status === 'draft' && (
                              <HStack spacing={1}>
                                <IconButton
                                  aria-label="Edit draft"
                                  icon={<FaEdit />}
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => loadDraft(post)}
                                />
                                <IconButton
                                  aria-label="Delete draft"
                                  icon={<FaTrash />}
                                  size="xs"
                                  variant="ghost"
                                  colorScheme="red"
                                  onClick={() => deleteDraft(post.id)}
                                />
                              </HStack>
                            )}
                          </HStack>
                          
                          <Text fontSize="sm" noOfLines={3}>
                            {post.text}
                          </Text>
                          
                          <HStack spacing={1}>
                            {post.platforms.map(platform => {
                              const PlatformIcon = platformIcons[platform as keyof typeof platformIcons];
                              return (
                                <PlatformIcon
                                  key={platform}
                                  size={12}
                                  color={platformColors[platform as keyof typeof platformColors]}
                                />
                              );
                            })}
                          </HStack>
                          
                          <Text fontSize="xs" color="gray.500">
                            {post.publishedAt 
                              ? `Published ${post.publishedAt.toLocaleString()}`
                              : post.scheduledTime
                              ? `Scheduled for ${post.scheduledTime.toLocaleString()}`
                              : `Created ${post.createdAt.toLocaleString()}`
                            }
                          </Text>
                          
                          {post.engagement && (
                            <HStack fontSize="xs" color="gray.600">
                              <Text>👍 {post.engagement.likes}</Text>
                              <Text>🔄 {post.engagement.shares}</Text>
                              <Text>💬 {post.engagement.comments}</Text>
                              <Text>👁️ {post.engagement.views}</Text>
                            </HStack>
                          )}
                        </VStack>
                      </CardBody>
                    </Card>
                  );
                })
              )}
            </VStack>
          </CardBody>
        </Card>
      </GridItem>

      {/* Preview Modal */}
      <Modal isOpen={isPreviewOpen} onClose={onPreviewClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Post Preview</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Select
                value={previewMode}
                onChange={(e) => setPreviewMode(e.target.value)}
              >
                {selectedPlatforms.map(platform => (
                  <option key={platform} value={platform}>
                    {platform.charAt(0).toUpperCase() + platform.slice(1)} Preview
                  </option>
                ))}
              </Select>
              
              <Card>
                <CardBody>
                  <VStack spacing={3} align="stretch">
                    <HStack>
                      <Avatar size="sm" name="Your Name" />
                      <VStack align="start" spacing={0}>
                        <Text fontWeight="bold" fontSize="sm">Your Name</Text>
                        <Text fontSize="xs" color="gray.500">Just now</Text>
                      </VStack>
                    </HStack>
                    
                    <Text>{currentPost.text}</Text>
                    
                    {currentPost.hashtags && currentPost.hashtags.length > 0 && (
                      <Text color="blue.500">
                        {currentPost.hashtags.map(tag => `#${tag}`).join(' ')}
                      </Text>
                    )}
                    
                    {currentPost.mentions && currentPost.mentions.length > 0 && (
                      <Text color="blue.500">
                        {currentPost.mentions.map(mention => `@${mention}`).join(' ')}
                      </Text>
                    )}
                    
                    {currentPost.mediaUrls && currentPost.mediaUrls.length > 0 && (
                      <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={2}>
                        {currentPost.mediaUrls.map((url, index) => (
                          <Image
                            key={index}
                            src={url}
                            alt={`Preview ${index + 1}`}
                            borderRadius="md"
                            maxH="200px"
                            objectFit="cover"
                          />
                        ))}
                      </Grid>
                    )}
                  </VStack>
                </CardBody>
              </Card>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onPreviewClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Grid>
  );
};

export default SocialPostingTab;
