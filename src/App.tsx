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
} from '@chakra-ui/react';
import Sidebar from './Sidebar';

// Lazy load components for better performance
const AnalyticsSection = lazy(() => import('./AnalyticsSection'));
const ChatSection = lazy(() => import('./ChatSection'));
const CampaignsSection = lazy(() => import('./CampaignsSection'));

function App() {
  // Core app state
  const [activeSection, setActiveSection] = useState('chat');
  const [accessToken, setAccessToken] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('725999993024554');
  const [unreadCount] = useState(0);
  
  // Settings panel state
  const { isOpen: isSettingsOpen, onToggle: onSettingsToggle } = useDisclosure();

  // Load credentials from localStorage on mount
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

  // Handle section changes
  const handleSectionChange = (section: string) => {
    setActiveSection(section);
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
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          unreadCount={unreadCount}
        />
        
        {/* Main Content Area */}
        <Box flex="1" ml="280px" overflow="auto" bg="gray.50">
          {/* Settings Panel */}
          <Box position="absolute" top={4} right={4} zIndex={999}>
            <Button onClick={onSettingsToggle} size="sm" colorScheme="blue" variant="outline">
              ⚙️ Settings
            </Button>
          </Box>

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
      </Flex>
    </ChakraProvider>
  );
}

export default App; 