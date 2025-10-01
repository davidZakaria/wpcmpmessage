import { useState, Suspense, lazy, useEffect } from 'react';
import {
  ChakraProvider,
  Box,
  Flex,
  Spinner,
  VStack,
  Text,
  FormControl,
  FormLabel,
  Input,
  HStack,
  Button,
  Alert,
  AlertIcon,
  Collapse,
  useDisclosure,
  Badge,
  Avatar,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  Icon,
  useToast
} from '@chakra-ui/react';
import { FaUser, FaSignOutAlt, FaCog, FaSignInAlt } from 'react-icons/fa';
import Sidebar from './Sidebar';
import LoginModal from './components/LoginModal';
import { userManagementService, User } from './services/userManagementService';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy load components for better performance
const AnalyticsSection = lazy(() => import('./AnalyticsSection'));
const ChatSection = lazy(() => import('./ChatSection'));
const CampaignsSection = lazy(() => import('./CampaignsSection'));
const SocialModerationSection = lazy(() => import('./SocialModerationSection'));
const PlatformTestingSection = lazy(() => import('./PlatformTestingSection'));
const DemoModeSection = lazy(() => import('./DemoModeSection'));
const TwitterYouTubeSetup = lazy(() => import('./TwitterYouTubeSetup'));

function App() {
  // Core app state
  const [activeHub, setActiveHub] = useState('whatsapp'); // 'whatsapp' or 'social'
  const [activeSection, setActiveSection] = useState('chat');
  const [accessToken, setAccessToken] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('725999993024554');
  const [unreadCount] = useState(0);
  
  // User authentication state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Modal states
  const { isOpen: isSettingsOpen, onToggle: onSettingsToggle } = useDisclosure();
  const { isOpen: isLoginOpen, onOpen: onLoginOpen, onClose: onLoginClose } = useDisclosure();
  
  const toast = useToast();

  // Load credentials and check authentication on mount
  useEffect(() => {
    const savedAccessToken = localStorage.getItem('whatsapp_access_token');
    const savedPhoneNumberId = localStorage.getItem('whatsapp_phone_number_id');
    
    if (savedAccessToken) {
      setAccessToken(savedAccessToken);
      console.log('✅ Loaded saved access token from localStorage');
    }
    if (savedPhoneNumberId) {
      setPhoneNumberId(savedPhoneNumberId);
      console.log('✅ Loaded saved phone number ID from localStorage');
    }

    // Check if user is already authenticated
    const user = userManagementService.getCurrentUser();
    if (user && userManagementService.isAuthenticated()) {
      setCurrentUser(user);
      setIsAuthenticated(true);
      console.log('✅ User session restored:', user.name);
    }
  }, []);

  // Save credentials to localStorage when they change
  useEffect(() => {
    if (accessToken) {
      localStorage.setItem('whatsapp_access_token', accessToken);
      console.log('💾 Saved access token to localStorage');
    } else {
      localStorage.removeItem('whatsapp_access_token');
    }
  }, [accessToken]);

  useEffect(() => {
    if (phoneNumberId) {
      localStorage.setItem('whatsapp_phone_number_id', phoneNumberId);
      console.log('💾 Saved phone number ID to localStorage');
    }
  }, [phoneNumberId]);

  // Handle hub changes
  const handleHubChange = (hub: string) => {
    setActiveHub(hub);
    // Set default section for each hub
    if (hub === 'whatsapp') {
      setActiveSection('chat');
    } else if (hub === 'social') {
      setActiveSection('moderation');
    }
  };

  // Handle section changes
  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    // Auto-switch hub based on section
    if (['chat', 'campaigns', 'analytics'].includes(section)) {
      setActiveHub('whatsapp');
    } else if (['moderation', 'platform-testing', 'twitter-youtube-setup', 'demo-mode'].includes(section)) {
      setActiveHub('social');
    }
  };

  // Authentication handlers
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    
    toast({
      title: 'Welcome!',
      description: `Signed in as ${user.name} (${user.role})`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleLogout = async () => {
    await userManagementService.logout();
    setCurrentUser(null);
    setIsAuthenticated(false);
    
    toast({
      title: 'Signed Out',
      description: 'You have been successfully signed out',
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };

  // Render the active section with lazy loading
  const renderActiveSection = () => {
    const LoadingSpinner = (
      <VStack spacing={4} justify="center" align="center" h="400px">
        <Spinner size="xl" color="blue.500" />
        <Text color="gray.500">Loading...</Text>
      </VStack>
    );

    switch (activeSection) {
      case 'chat':
        return (
          <Suspense fallback={LoadingSpinner}>
            <ChatSection accessToken={accessToken} phoneNumberId={phoneNumberId} />
          </Suspense>
        );
      case 'campaigns':
        return (
          <Suspense fallback={LoadingSpinner}>
            <CampaignsSection accessToken={accessToken} phoneNumberId={phoneNumberId} />
          </Suspense>
        );
      case 'analytics':
        return (
          <Suspense fallback={LoadingSpinner}>
            <AnalyticsSection />
          </Suspense>
        );
      case 'moderation':
        return (
          <ErrorBoundary
            onError={(error, errorInfo) => {
              console.error('Social Moderation Section crashed:', error, errorInfo);
            }}
          >
            <Suspense fallback={LoadingSpinner}>
              <SocialModerationSection />
            </Suspense>
          </ErrorBoundary>
        );
      case 'platform-testing':
        return (
          <Suspense fallback={LoadingSpinner}>
            <PlatformTestingSection />
          </Suspense>
        );
      case 'demo-mode':
        return (
          <Suspense fallback={LoadingSpinner}>
            <DemoModeSection />
          </Suspense>
        );
      case 'twitter-youtube-setup':
        return (
          <Suspense fallback={LoadingSpinner}>
            <TwitterYouTubeSetup />
          </Suspense>
        );
      default:
        return (
          <VStack spacing={4} justify="center" align="center" h="400px">
            <Text fontSize="xl" color="gray.500">Select a section from the sidebar</Text>
          </VStack>
        );
    }
  };

  return (
    <ChakraProvider>
      <Flex h="100vh" overflow="hidden">
        {/* Sidebar */}
        <Sidebar 
          activeHub={activeHub}
          activeSection={activeSection}
          onHubChange={handleHubChange}
          onSectionChange={handleSectionChange}
          unreadCount={unreadCount}
        />
        
        {/* Main Content Area */}
        <Box flex="1" ml="280px" overflow="auto" bg="gray.50">
          {/* Header with User Menu */}
          <Flex position="absolute" top={4} right={4} zIndex={999} gap={3}>
            {isAuthenticated && currentUser ? (
              <Menu>
                <MenuButton as={Button} variant="ghost" size="sm">
                  <HStack spacing={2}>
                    <Avatar size="sm" name={currentUser.name} />
                    <VStack spacing={0} align="start">
                      <Text fontSize="sm" fontWeight="medium">
                        {currentUser.name}
                      </Text>
                      <Badge size="sm" colorScheme="blue" variant="subtle">
                        {currentUser.role}
                      </Badge>
                    </VStack>
                  </HStack>
                </MenuButton>
                <MenuList>
                  <MenuItem icon={<FaUser />}>
                    Profile
                  </MenuItem>
                  <MenuItem icon={<FaCog />} onClick={onSettingsToggle}>
                    Settings
                  </MenuItem>
                  <MenuDivider />
                  <MenuItem icon={<FaSignOutAlt />} onClick={handleLogout}>
                    Sign Out
                  </MenuItem>
                </MenuList>
              </Menu>
            ) : (
              <HStack spacing={2}>
                <Button 
                  onClick={onLoginOpen} 
                  size="sm" 
                  colorScheme="blue" 
                  leftIcon={<FaSignInAlt />}
                >
                  Sign In
                </Button>
                <Button onClick={onSettingsToggle} size="sm" variant="outline">
                  <Icon as={FaCog} />
                </Button>
              </HStack>
            )}
          </Flex>

          <Collapse in={isSettingsOpen}>
            <Box bg="white" p={6} m={4} borderRadius="md" shadow="md" border="1px solid" borderColor="gray.200">
              <VStack spacing={4} align="stretch">
                <Text fontSize="lg" fontWeight="bold" color="blue.600">
                  🔐 API Configuration
                </Text>
                
                <HStack spacing={4}>
                  <FormControl>
                    <FormLabel fontSize="sm">Access Token</FormLabel>
                    <Input
                      type="password"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="Enter your WhatsApp Access Token"
                      size="sm"
                    />
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel fontSize="sm">Phone Number ID</FormLabel>
                    <Input
                      value={phoneNumberId}
                      onChange={(e) => setPhoneNumberId(e.target.value)}
                      placeholder="Enter Phone Number ID"
                      size="sm"
                    />
                  </FormControl>
                </HStack>

                {/* Credentials Status */}
                {(!accessToken || !phoneNumberId) ? (
                  <Alert status="warning" size="sm">
                    <AlertIcon />
                    Please configure your API credentials to use all features
                  </Alert>
                ) : (
                  <Alert status="success" size="sm">
                    <AlertIcon />
                    ✅ Credentials configured and saved locally
                  </Alert>
                )}

                {/* Clear Credentials Button */}
                <Button
                  size="sm"
                  colorScheme="red"
                  variant="outline"
                  onClick={() => {
                    setAccessToken('');
                    setPhoneNumberId('725999993024554');
                    localStorage.removeItem('whatsapp_access_token');
                    localStorage.removeItem('whatsapp_phone_number_id');
                    console.log('🗑️ Cleared all saved credentials');
                    alert('Credentials cleared! Enter new ones above.');
                  }}
                >
                  🗑️ Clear Saved Credentials
                </Button>
              </VStack>
            </Box>
          </Collapse>

          {/* Main Content */}
          <Box p={0}>
            {renderActiveSection()}
          </Box>
        </Box>

        {/* Login Modal */}
        <LoginModal
          isOpen={isLoginOpen}
          onClose={onLoginClose}
          onLoginSuccess={handleLoginSuccess}
        />
      </Flex>
    </ChakraProvider>
  );
}

export default App; 