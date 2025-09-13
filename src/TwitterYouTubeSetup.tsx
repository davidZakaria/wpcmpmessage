import React, { useState, useEffect } from 'react';
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
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Code,
  Input,
  FormControl,
  FormLabel,
  Textarea,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  List,
  ListItem,
  ListIcon,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Divider,
  Icon,
  Link,
} from '@chakra-ui/react';
import {
  FaTwitter,
  FaYoutube,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaCopy,
  FaExternalLinkAlt,
  FaCog,
  FaKey,
  FaLink,
} from 'react-icons/fa';
import { platformAuth } from './services/platformAuth';

interface PlatformSetup {
  id: string;
  name: string;
  icon: any;
  color: string;
  hasCredentials: boolean;
  isConnected: boolean;
  setupSteps: string[];
  developerUrl: string;
  redirectUri: string;
  requiredScopes: string[];
  commonIssues: string[];
}

const TwitterYouTubeSetup: React.FC = () => {
  const [platforms, setPlatforms] = useState<PlatformSetup[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformSetup | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [isTestingConnection, setIsTestingConnection] = useState<Record<string, boolean>>({});
  
  const { isOpen: isSetupModalOpen, onOpen: onSetupModalOpen, onClose: onSetupModalClose } = useDisclosure();
  const toast = useToast();

  useEffect(() => {
    initializePlatforms();
    
    // Check if we just completed an OAuth flow (page was refreshed after OAuth)
    checkForCompletedOAuth();
    
    // Listen for OAuth messages from popup windows
    const handleMessage = async (event: MessageEvent) => {
      console.log('📨 Message received from:', event.origin, event.data);
      
      // Only accept messages from our server
      if (event.origin !== 'http://localhost:3002') {
        console.log('🚫 Ignoring message from unknown origin:', event.origin);
        return;
      }
      
      if (event.data.type === 'oauth_success') {
        console.log('✅ OAuth success message received:', event.data);
        await processOAuthSuccess(event.data.platform, event.data.code, event.data.state);
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    // Cleanup
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const checkForCompletedOAuth = async () => {
    console.log('🔍 Checking for OAuth completion...');
    console.log('🔍 Current URL:', window.location.href);
    
    // Method 1: Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSuccess = urlParams.get('oauth_success');
    const oauthError = urlParams.get('oauth_error');
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    
    console.log('🔍 URL parameters found:', {
      oauthSuccess,
      oauthError,
      hasCode: !!code,
      hasState: !!state,
      error
    });
    
    if (oauthSuccess && code && state) {
      console.log(`✅ Found OAuth success in URL for ${oauthSuccess} with code and state`);
      
      // Clear the URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Process the OAuth callback to actually exchange the code for tokens
      await processOAuthSuccess(oauthSuccess, code, state);
      
      console.log(`✅ ${oauthSuccess} connection completed successfully`);
      
      // Refresh page after a short delay to sync all components
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
      return;
    } else if (oauthError) {
      console.log(`❌ Found OAuth error in URL for ${oauthError}: ${error}`);
      
      // Clear the URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      toast({
        title: 'OAuth Error',
        description: `Failed to connect to ${oauthError}: ${decodeURIComponent(error || 'Unknown error')}`,
        status: 'error',
        duration: 10000,
        isClosable: true,
      });
      return;
    }
    
    // Method 2: Check localStorage for OAuth completion
    const platformIds = ['twitter', 'youtube', 'facebook', 'instagram', 'linkedin'];
    
    for (const platformId of platformIds) {
      const storageKey = `oauth_result_${platformId}`;
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        try {
          const data = JSON.parse(stored);
          console.log(`✅ Found OAuth result in localStorage for ${platformId}:`, data);
          
          // Remove the flag so it doesn't trigger again
          localStorage.removeItem(storageKey);
          
          if (data.code && data.state) {
            await processOAuthSuccess(platformId, data.code, data.state);
          }
          
        } catch (error) {
          console.error(`Failed to parse OAuth result data for ${platformId}:`, error);
          localStorage.removeItem(storageKey);
        }
      }
    }
  };

  const processOAuthSuccess = async (platform: string, code: string, state: string) => {
    try {
      console.log(`🔄 Processing OAuth callback for ${platform}:`, { 
        code: code.substring(0, 20) + '...', 
        state,
        timestamp: new Date().toISOString()
      });

      console.log(`🔍 Before handleCallback - checking current connection status:`, {
        isConnected: platformAuth.isConnected(platform),
        hasCredentials: !!platformAuth.getCredentials(platform)
      });

      // Process the OAuth callback with platformAuth service
      const credentials = await platformAuth.handleCallback(platform, code, state);
      
      console.log(`✅ OAuth credentials processed for ${platform}:`, {
        hasCredentials: !!credentials,
        userId: credentials?.userId,
        userName: credentials?.userName,
        hasAccessToken: !!credentials?.accessToken
      });

      console.log(`🔍 After handleCallback - checking connection status:`, {
        isConnected: platformAuth.isConnected(platform),
        hasCredentials: !!platformAuth.getCredentials(platform)
      });
      
      // Update platform status
      setPlatforms(prev => prev.map(p => 
        p.id === platform ? { ...p, isConnected: true } : p
      ));
      
      toast({
        title: 'Connection Successful!',
        description: `Successfully connected to ${platform.charAt(0).toUpperCase() + platform.slice(1)} as ${credentials.userName}`,
        status: 'success',
        duration: 8000,
        isClosable: true,
      });
      
      console.log(`✅ ${platform} connection completed successfully`);
      
      // Trigger a page refresh to sync all components
      setTimeout(() => {
        console.log('🔄 Refreshing page to sync all components...');
        window.location.reload();
      }, 2000);
      
    } catch (error: any) {
      console.error(`❌ OAuth callback processing failed for ${platform}:`, error);
      console.error(`❌ Error details:`, {
        message: error.message,
        stack: error.stack?.substring(0, 500)
      });
      toast({
        title: 'OAuth Processing Error',
        description: `Failed to complete ${platform} connection: ${error.message}`,
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
    }
  };

  const initializePlatforms = () => {
    const platformSetups: PlatformSetup[] = [
      {
        id: 'twitter',
        name: 'Twitter/X',
        icon: FaTwitter,
        color: 'blue',
        hasCredentials: !!(import.meta.env.VITE_TWITTER_CLIENT_ID && import.meta.env.VITE_TWITTER_CLIENT_SECRET),
        isConnected: platformAuth.isConnected('twitter'),
        setupSteps: [
          'Go to https://developer.twitter.com/',
          'Sign in with your Twitter account',
          'Create a new project and app',
          'Generate API keys and tokens',
          'Enable OAuth 2.0 with PKCE',
          'Add redirect URI: http://localhost:3001/auth/twitter/callback',
          'Copy Client ID and Client Secret to .env file'
        ],
        developerUrl: 'https://developer.twitter.com/',
        redirectUri: 'http://localhost:3001/auth/twitter/callback',
        requiredScopes: ['tweet.read', 'users.read', 'follows.read'],
        commonIssues: [
          'App not approved for OAuth 2.0',
          'Redirect URI mismatch',
          'Invalid Client ID or Secret',
          'Missing required scopes',
          'App suspended or restricted'
        ]
      },
      {
        id: 'youtube',
        name: 'YouTube',
        icon: FaYoutube,
        color: 'red',
        hasCredentials: !!(import.meta.env.VITE_YOUTUBE_CLIENT_ID && import.meta.env.VITE_YOUTUBE_CLIENT_SECRET),
        isConnected: platformAuth.isConnected('youtube'),
        setupSteps: [
          'Go to https://console.developers.google.com/',
          'Create a new project or select existing',
          'Enable YouTube Data API v3',
          'Create OAuth 2.0 credentials',
          'Add authorized redirect URI: http://localhost:3001/auth/youtube/callback',
          'Copy Client ID and Client Secret to .env file',
          'Configure OAuth consent screen'
        ],
        developerUrl: 'https://console.developers.google.com/',
        redirectUri: 'http://localhost:3001/auth/youtube/callback',
        requiredScopes: ['https://www.googleapis.com/auth/youtube.readonly'],
        commonIssues: [
          'YouTube Data API not enabled',
          'OAuth consent screen not configured',
          'Redirect URI not authorized',
          'Invalid Client ID or Secret',
          'Quota exceeded',
          'App not verified by Google'
        ]
      }
    ];

    setPlatforms(platformSetups);
  };

  const testPlatformConnection = async (platformId: string) => {
    setIsTestingConnection(prev => ({ ...prev, [platformId]: true }));
    const platform = platforms.find(p => p.id === platformId);
    
    try {
      // Check if credentials exist
      if (!platform?.hasCredentials) {
        throw new Error('API credentials not configured in .env file');
      }

      // Generate OAuth URL to test configuration
      const authUrl = await platformAuth.generateAuthUrl(platformId);
      
      // Test if we can reach the OAuth endpoint
      const testResult = {
        platform: platformId,
        status: 'success',
        message: 'OAuth URL generated successfully. Credentials appear to be configured.',
        details: {
          authUrl: authUrl.substring(0, 100) + '...',
          hasClientId: !!import.meta.env[`VITE_${platformId.toUpperCase()}_CLIENT_ID`],
          hasClientSecret: !!import.meta.env[`VITE_${platformId.toUpperCase()}_CLIENT_SECRET`],
          redirectUri: platform.redirectUri
        },
        timestamp: new Date()
      };

      setTestResults(prev => ({ ...prev, [platformId]: testResult }));
      
      toast({
        title: 'Configuration Test Passed',
        description: `${platform.name} credentials are configured correctly`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

    } catch (error: any) {
      const testResult = {
        platform: platformId,
        status: 'error',
        message: error.message,
        details: {
          hasClientId: !!import.meta.env[`VITE_${platformId.toUpperCase()}_CLIENT_ID`],
          hasClientSecret: !!import.meta.env[`VITE_${platformId.toUpperCase()}_CLIENT_SECRET`],
          error: error.message
        },
        timestamp: new Date()
      };

      setTestResults(prev => ({ ...prev, [platformId]: testResult }));
      
      toast({
        title: 'Configuration Test Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsTestingConnection(prev => ({ ...prev, [platformId]: false }));
    }
  };

  const attemptConnection = async (platformId: string) => {
    const platform = platforms.find(p => p.id === platformId);
    if (!platform?.hasCredentials) {
      toast({
        title: 'Missing Credentials',
        description: `Please configure ${platform?.name} API credentials first`,
        status: 'warning',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    try {
      const authUrl = await platformAuth.generateAuthUrl(platformId);
      
      console.log(`🚀 Opening OAuth popup for ${platformId}:`, authUrl);

      // Simple popup approach - let the server handle everything
      const popup = window.open(
        authUrl,
        `oauth_${platformId}_${Date.now()}`,
        'width=600,height=700,left=' + (screen.width / 2 - 300) + ',top=' + (screen.height / 2 - 350) + 
        ',scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no'
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site and try again.');
      }

      popup.focus();
            
            toast({
        title: 'OAuth Started',
        description: `Complete the authorization in the popup. The page will refresh automatically when done.`,
        status: 'info',
        duration: 8000,
              isClosable: true,
            });
            
      console.log('✅ OAuth popup opened. The server will handle the rest and refresh the page automatically.');

      // That's it! The server callback will:
      // 1. Process the OAuth code
      // 2. Store the credentials
      // 3. Close the popup
      // 4. Refresh the parent page
      // 5. The page refresh will detect the new connection

    } catch (error: any) {
      console.error('Connection error:', error);
      toast({
        title: 'Connection Error',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to Clipboard',
      description: 'Text has been copied to clipboard',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const manualCheckConnection = async (platformId: string) => {
    console.log(`🔍 Manually checking connection for ${platformId}...`);
    
    // Debug localStorage contents
    const credentialsKey = `social_mod_${platformId}_credentials`;
    const storedCredentials = localStorage.getItem(credentialsKey);
    console.log(`📋 Stored credentials for ${platformId}:`, storedCredentials);
    
    // Check if already connected via platformAuth
    const isConnected = platformAuth.isConnected(platformId);
    console.log(`🔗 platformAuth.isConnected(${platformId}):`, isConnected);
    
    // Check for OAuth success flags
    const oauthResult = platformAuth.checkOAuthSuccess(platformId);
    console.log(`📨 OAuth success check for ${platformId}:`, oauthResult);
    console.log(`📋 OAuth success data:`, oauthResult.data);
    
    // Check localStorage for oauth results
    const oauthResultKey = `oauth_result_${platformId}`;
    const oauthResultStored = localStorage.getItem(oauthResultKey);
    console.log(`💾 OAuth result in localStorage for ${platformId}:`, oauthResultStored);
    
    if (oauthResult.success) {
      console.log('✅ Found OAuth success, processing...');
      if (oauthResult.data?.code && oauthResult.data?.state) {
        console.log('🔄 Processing OAuth with code and state...');
        await processOAuthSuccess(platformId, oauthResult.data.code, oauthResult.data.state);
      } else {
        console.log('⚠️ OAuth success found but missing code/state:', oauthResult.data);
      }
      return;
    }
    
    if (oauthResultStored) {
      console.log('✅ Found OAuth result in localStorage, processing...');
      try {
        const data = JSON.parse(oauthResultStored);
        localStorage.removeItem(oauthResultKey);
        processOAuthSuccess(platformId, data.code, data.state);
        return;
      } catch (e) {
        console.error('Failed to parse OAuth result:', e);
      }
    }
    
    if (isConnected) {
      console.log('✅ Platform already connected, updating UI');
      setPlatforms(prev => prev.map(p => 
        p.id === platformId ? { ...p, isConnected: true } : p
      ));
      toast({
        title: 'Already Connected',
        description: `${platforms.find(p => p.id === platformId)?.name} is already connected`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    // No connection found
    console.log('❌ No connection found');
    toast({
      title: 'No Connection Found',
      description: 'Please try the OAuth flow again. Check browser console for details.',
      status: 'warning',
      duration: 5000,
      isClosable: true,
    });
  };

  const getStatusIcon = (platform: PlatformSetup) => {
    if (platform.isConnected) return <Icon as={FaCheckCircle} color="green.500" />;
    if (platform.hasCredentials) return <Icon as={FaExclamationTriangle} color="yellow.500" />;
    return <Icon as={FaTimesCircle} color="red.500" />;
  };

  const getStatusText = (platform: PlatformSetup) => {
    if (platform.isConnected) return 'Connected';
    if (platform.hasCredentials) return 'Ready to Connect';
    return 'Not Configured';
  };

  const getStatusColor = (platform: PlatformSetup) => {
    if (platform.isConnected) return 'green';
    if (platform.hasCredentials) return 'yellow';
    return 'red';
  };

  return (
    <Box w="full" h="full" p={6}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <HStack justify="space-between" align="center">
          <VStack align="start" spacing={1}>
            <Heading size="lg" color="blue.600">
              🐦 Twitter & YouTube Setup
            </Heading>
            <Text color="gray.600" fontSize="sm">
              Connect Twitter and YouTube platforms to your social media moderation system
            </Text>
          </VStack>
        </HStack>

        {/* Environment Check */}
        <Alert status="info">
          <AlertIcon />
          <Box>
            <AlertTitle>Environment Status</AlertTitle>
            <AlertDescription>
              <VStack align="start" spacing={2} mt={2}>
                <HStack>
                  <Badge colorScheme={import.meta.env.VITE_TWITTER_CLIENT_ID ? 'green' : 'red'}>
                    Twitter Client ID: {import.meta.env.VITE_TWITTER_CLIENT_ID ? 'Configured' : 'Missing'}
                  </Badge>
                  <Badge colorScheme={import.meta.env.VITE_TWITTER_CLIENT_SECRET ? 'green' : 'red'}>
                    Twitter Secret: {import.meta.env.VITE_TWITTER_CLIENT_SECRET ? 'Configured' : 'Missing'}
                  </Badge>
                </HStack>
                <HStack>
                  <Badge colorScheme={import.meta.env.VITE_YOUTUBE_CLIENT_ID ? 'green' : 'red'}>
                    YouTube Client ID: {import.meta.env.VITE_YOUTUBE_CLIENT_ID ? 'Configured' : 'Missing'}
                  </Badge>
                  <Badge colorScheme={import.meta.env.VITE_YOUTUBE_CLIENT_SECRET ? 'green' : 'red'}>
                    YouTube Secret: {import.meta.env.VITE_YOUTUBE_CLIENT_SECRET ? 'Configured' : 'Missing'}
                  </Badge>
                </HStack>
              </VStack>
            </AlertDescription>
          </Box>
        </Alert>

        {/* Platform Cards */}
        <VStack spacing={4} align="stretch">
          {platforms.map((platform) => (
            <Card key={platform.id}>
              <CardHeader>
                <HStack justify="space-between">
                  <HStack>
                    <Icon as={platform.icon} color={`${platform.color}.500`} boxSize={8} />
                    <VStack align="start" spacing={0}>
                      <Text fontSize="xl" fontWeight="bold">{platform.name}</Text>
                      <HStack>
                        {getStatusIcon(platform)}
                        <Badge colorScheme={getStatusColor(platform)}>
                          {getStatusText(platform)}
                        </Badge>
                      </HStack>
                    </VStack>
                  </HStack>
                  
                  <HStack spacing={2}>
                    <Button
                      size="sm"
                      colorScheme="blue"
                      variant="outline"
                      onClick={() => testPlatformConnection(platform.id)}
                      isLoading={isTestingConnection[platform.id]}
                      loadingText="Testing..."
                    >
                      Test Config
                    </Button>
                    
                    {platform.hasCredentials ? (
                      <HStack spacing={2}>
                      <Button
                        size="sm"
                        colorScheme="green"
                        onClick={() => attemptConnection(platform.id)}
                        isDisabled={platform.isConnected}
                      >
                        {platform.isConnected ? 'Connected' : 'Connect'}
                      </Button>
                        {!platform.isConnected && (
                          <Button
                            size="sm"
                            colorScheme="blue"
                            variant="outline"
                            onClick={() => manualCheckConnection(platform.id)}
                          >
                            Check
                          </Button>
                        )}
                      </HStack>
                    ) : (
                      <Button
                        size="sm"
                        colorScheme="orange"
                        onClick={() => {
                          setSelectedPlatform(platform);
                          onSetupModalOpen();
                        }}
                      >
                        Setup Guide
                      </Button>
                    )}
                  </HStack>
                </HStack>
              </CardHeader>
              
              <CardBody>
                <VStack spacing={4} align="stretch">
                  {/* Configuration Status */}
                  <Box>
                    <Text fontWeight="bold" mb={2}>Configuration Status:</Text>
                    <HStack spacing={4}>
                      <Badge colorScheme={platform.hasCredentials ? 'green' : 'red'}>
                        API Keys: {platform.hasCredentials ? 'Configured' : 'Missing'}
                      </Badge>
                      <Badge colorScheme="blue">
                        Redirect URI: Configured
                      </Badge>
                    </HStack>
                  </Box>

                  {/* Test Results */}
                  {testResults[platform.id] && (
                    <Box>
                      <Text fontWeight="bold" mb={2}>Last Test Result:</Text>
                      <Alert status={testResults[platform.id].status === 'success' ? 'success' : 'error'}>
                        <AlertIcon />
                        <Box>
                          <Text fontSize="sm">{testResults[platform.id].message}</Text>
                          <Text fontSize="xs" color="gray.500" mt={1}>
                            {testResults[platform.id].timestamp.toLocaleString()}
                          </Text>
                        </Box>
                      </Alert>
                    </Box>
                  )}

                  {/* Quick Setup Info */}
                  <Accordion allowToggle>
                    <AccordionItem>
                      <AccordionButton>
                        <Box flex="1" textAlign="left">
                          <Text fontSize="sm" fontWeight="bold">Quick Setup Info</Text>
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                      <AccordionPanel pb={4}>
                        <VStack spacing={3} align="stretch">
                          <Box>
                            <Text fontSize="sm" fontWeight="bold">Developer Console:</Text>
                            <Link href={platform.developerUrl} isExternal color="blue.500">
                              {platform.developerUrl} <Icon as={FaExternalLinkAlt} mx="2px" />
                            </Link>
                          </Box>
                          
                          <Box>
                            <Text fontSize="sm" fontWeight="bold">Redirect URI:</Text>
                            <HStack>
                              <Code fontSize="xs">{platform.redirectUri}</Code>
                              <Button size="xs" onClick={() => copyToClipboard(platform.redirectUri)}>
                                <Icon as={FaCopy} />
                              </Button>
                            </HStack>
                          </Box>
                          
                          <Box>
                            <Text fontSize="sm" fontWeight="bold">Required Scopes:</Text>
                            <Code fontSize="xs">{platform.requiredScopes.join(', ')}</Code>
                          </Box>
                        </VStack>
                      </AccordionPanel>
                    </AccordionItem>
                  </Accordion>
                </VStack>
              </CardBody>
            </Card>
          ))}
        </VStack>

        {/* Environment Variables Template */}
        <Card>
          <CardHeader>
            <Text fontWeight="bold">Environment Variables Template</Text>
          </CardHeader>
          <CardBody>
            <VStack spacing={3} align="stretch">
              <Text fontSize="sm" color="gray.600">
                Add these to your .env file:
              </Text>
              <Box position="relative">
                <Textarea
                  value={`# Twitter API v2
VITE_TWITTER_CLIENT_ID=your_twitter_client_id_here
VITE_TWITTER_CLIENT_SECRET=your_twitter_client_secret_here

# YouTube Data API v3 (Google)
VITE_YOUTUBE_CLIENT_ID=your_google_client_id_here
VITE_YOUTUBE_CLIENT_SECRET=your_google_client_secret_here`}
                  readOnly
                  h="120px"
                  fontFamily="monospace"
                  fontSize="sm"
                />
                <Button
                  position="absolute"
                  top={2}
                  right={2}
                  size="xs"
                  onClick={() => copyToClipboard(`# Twitter API v2
VITE_TWITTER_CLIENT_ID=your_twitter_client_id_here
VITE_TWITTER_CLIENT_SECRET=your_twitter_client_secret_here

# YouTube Data API v3 (Google)
VITE_YOUTUBE_CLIENT_ID=your_google_client_id_here
VITE_YOUTUBE_CLIENT_SECRET=your_google_client_secret_here`)}
                >
                  <Icon as={FaCopy} />
                </Button>
              </Box>
            </VStack>
          </CardBody>
        </Card>
      </VStack>

      {/* Setup Guide Modal */}
      <Modal isOpen={isSetupModalOpen} onClose={onSetupModalClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <HStack>
              <Icon as={selectedPlatform?.icon} color={`${selectedPlatform?.color}.500`} />
              <Text>{selectedPlatform?.name} Setup Guide</Text>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedPlatform && (
              <VStack spacing={4} align="stretch">
                <Alert status="info">
                  <AlertIcon />
                  <Text fontSize="sm">
                    Follow these steps to set up {selectedPlatform.name} API access:
                  </Text>
                </Alert>

                <Box>
                  <Text fontWeight="bold" mb={2}>Setup Steps:</Text>
                  <List spacing={2}>
                    {selectedPlatform.setupSteps.map((step, index) => (
                      <ListItem key={index}>
                        <ListIcon as={FaCheckCircle} color="green.500" />
                        <Text fontSize="sm">{step}</Text>
                      </ListItem>
                    ))}
                  </List>
                </Box>

                <Divider />

                <Box>
                  <Text fontWeight="bold" mb={2}>Common Issues:</Text>
                  <List spacing={1}>
                    {selectedPlatform.commonIssues.map((issue, index) => (
                      <ListItem key={index}>
                        <ListIcon as={FaExclamationTriangle} color="orange.500" />
                        <Text fontSize="sm">{issue}</Text>
                      </ListItem>
                    ))}
                  </List>
                </Box>

                <Divider />

                <Box>
                  <Text fontWeight="bold" mb={2}>Important URLs:</Text>
                  <VStack spacing={2} align="stretch">
                    <HStack>
                      <Text fontSize="sm" fontWeight="bold">Developer Console:</Text>
                      <Link href={selectedPlatform.developerUrl} isExternal color="blue.500">
                        {selectedPlatform.developerUrl} <Icon as={FaExternalLinkAlt} mx="2px" />
                      </Link>
                    </HStack>
                    <HStack>
                      <Text fontSize="sm" fontWeight="bold">Redirect URI:</Text>
                      <Code fontSize="sm">{selectedPlatform.redirectUri}</Code>
                      <Button size="xs" onClick={() => copyToClipboard(selectedPlatform.redirectUri)}>
                        <Icon as={FaCopy} />
                      </Button>
                    </HStack>
                  </VStack>
                </Box>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onSetupModalClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default TwitterYouTubeSetup;
