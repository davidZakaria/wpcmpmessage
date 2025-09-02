import React from 'react';
import {
  Box,
  VStack,
  Heading,
  Text,
  Alert,
  AlertIcon,
  Code,
  UnorderedList,
  ListItem,
  Divider,
  Badge,
  HStack,
} from '@chakra-ui/react';

const WhatsAppTroubleshooting: React.FC = () => {
  return (
    <Box w="full" p={6}>
      <VStack spacing={6} align="stretch" maxW="4xl" mx="auto">
        <Heading size="lg" color="blue.600">
          🔧 WhatsApp Business API Troubleshooting
        </Heading>

        <Alert status="info">
          <AlertIcon />
          <Text>
            This guide helps you fix the common 400 error when accessing WhatsApp Business message templates.
          </Text>
        </Alert>

        {/* Most Common Issues */}
        <Box border="1px solid" borderColor="red.200" p={6} borderRadius="md" bg="red.50">
          <Heading size="md" color="red.600" mb={4}>
            🚨 Most Common Issues
          </Heading>
          
          <VStack spacing={4} align="stretch">
            <HStack>
              <Badge colorScheme="red">Issue #1</Badge>
              <Text fontWeight="bold">Access Token Lacks WhatsApp Business Permissions</Text>
            </HStack>
            <Text fontSize="sm" ml={6}>
              Your access token works for basic Facebook API but doesn't have WhatsApp Business permissions.
            </Text>
            
            <HStack>
              <Badge colorScheme="orange">Issue #2</Badge>
              <Text fontWeight="bold">Wrong Phone Number ID</Text>
            </HStack>
            <Text fontSize="sm" ml={6}>
              The Phone Number ID doesn't match your WhatsApp Business Account or isn't accessible.
            </Text>
            
            <HStack>
              <Badge colorScheme="yellow">Issue #3</Badge>
              <Text fontWeight="bold">Using Regular Facebook App Instead of WhatsApp Business App</Text>
            </HStack>
            <Text fontSize="sm" ml={6}>
              You need a WhatsApp Business App in Meta Developer Console, not a regular Facebook app.
            </Text>
          </VStack>
        </Box>

        {/* Step by Step Solution */}
        <Box border="1px solid" borderColor="green.200" p={6} borderRadius="md" bg="green.50">
          <Heading size="md" color="green.600" mb={4}>
            ✅ Step-by-Step Solution
          </Heading>

          <VStack spacing={6} align="stretch">
            {/* Step 1 */}
            <Box>
              <HStack mb={2}>
                <Badge colorScheme="green">Step 1</Badge>
                <Text fontWeight="bold">Create/Verify WhatsApp Business App</Text>
              </HStack>
              <UnorderedList spacing={1} ml={6} fontSize="sm">
                <ListItem>Go to <Code fontSize="xs">developers.facebook.com</Code></ListItem>
                <ListItem>Create a new app → Select "Business" → Choose "WhatsApp Business Platform"</ListItem>
                <ListItem>OR verify your existing app has "WhatsApp" product added</ListItem>
              </UnorderedList>
            </Box>

            <Divider />

            {/* Step 2 */}
            <Box>
              <HStack mb={2}>
                <Badge colorScheme="green">Step 2</Badge>
                <Text fontWeight="bold">Generate Proper Access Token</Text>
              </HStack>
              <UnorderedList spacing={1} ml={6} fontSize="sm">
                <ListItem>In your WhatsApp Business App, go to "WhatsApp" → "Getting Started"</ListItem>
                <ListItem>Generate a temporary access token (for testing)</ListItem>
                <ListItem>Ensure it has these permissions:</ListItem>
              </UnorderedList>
              <Code fontSize="xs" mt={2} p={2} display="block" bg="white" ml={6}>
                • whatsapp_business_messaging{'\n'}
                • whatsapp_business_management{'\n'}
                • business_management{'\n'}
                • pages_messaging
              </Code>
            </Box>

            <Divider />

            {/* Step 3 */}
            <Box>
              <HStack mb={2}>
                <Badge colorScheme="green">Step 3</Badge>
                <Text fontWeight="bold">Get Correct Phone Number ID</Text>
              </HStack>
              <UnorderedList spacing={1} ml={6} fontSize="sm">
                <ListItem>In WhatsApp Business App → "WhatsApp" → "Getting Started"</ListItem>
                <ListItem>Look for "Phone Number ID" (not the actual phone number)</ListItem>
                <ListItem>It should look like: <Code fontSize="xs">123456789012345</Code></ListItem>
                <ListItem>Copy this exact ID to your app settings</ListItem>
              </UnorderedList>
            </Box>

            <Divider />

            {/* Step 4 */}
            <Box>
              <HStack mb={2}>
                <Badge colorScheme="green">Step 4</Badge>
                <Text fontWeight="bold">Verify WhatsApp Business Manager Setup</Text>
              </HStack>
              <UnorderedList spacing={1} ml={6} fontSize="sm">
                <ListItem>Go to <Code fontSize="xs">business.facebook.com</Code></ListItem>
                <ListItem>Ensure your phone number is verified and has an approved display name</ListItem>
                <ListItem>Check that the phone number is connected to your Business Account</ListItem>
              </UnorderedList>
            </Box>
          </VStack>
        </Box>

        {/* Testing Your Setup */}
        <Box border="1px solid" borderColor="blue.200" p={6} borderRadius="md" bg="blue.50">
          <Heading size="md" color="blue.600" mb={4}>
            🧪 Test Your Setup
          </Heading>
          
          <VStack spacing={3} align="stretch">
            <Text>Use the diagnostic tools in your campaign manager:</Text>
            <UnorderedList spacing={1} ml={6} fontSize="sm">
              <ListItem>Click "🔍 Debug & Test Tools" in the campaign section</ListItem>
              <ListItem>Run "Test Access Token" to verify permissions</ListItem>
              <ListItem>Run "Test Phone ID" to verify phone number access</ListItem>
              <ListItem>Use "🔬 Full Diagnostic" for complete analysis</ListItem>
            </UnorderedList>
            
            <Alert status="warning" mt={4}>
              <AlertIcon />
              <Text fontSize="sm">
                <strong>Important:</strong> If diagnostics show permission issues, you need to generate 
                a new access token from your WhatsApp Business App, not a regular Facebook app.
              </Text>
            </Alert>
          </VStack>
        </Box>

        {/* Common Error Codes */}
        <Box border="1px solid" borderColor="purple.200" p={6} borderRadius="md" bg="purple.50">
          <Heading size="md" color="purple.600" mb={4">
            📋 Common Error Codes
          </Heading>
          
          <VStack spacing={3} align="stretch" fontSize="sm">
            <HStack>
              <Badge colorScheme="red">Error 100</Badge>
              <Text><strong>Invalid parameter:</strong> Phone Number ID is wrong or token lacks permissions</Text>
            </HStack>
            
            <HStack>
              <Badge colorScheme="orange">Error 190</Badge>
              <Text><strong>Access token expired:</strong> Generate a new access token</Text>
            </HStack>
            
            <HStack>
              <Badge colorScheme="yellow">Error 200</Badge>
              <Text><strong>Permissions error:</strong> Token doesn't have WhatsApp Business permissions</Text>
            </HStack>
            
            <HStack>
              <Badge colorScheme="gray">Error 400</Badge>
              <Text><strong>Bad Request:</strong> Usually means permission or parameter issues</Text>
            </HStack>
          </VStack>
        </Box>

        {/* Production Considerations */}
        <Box border="1px solid" borderColor="orange.200" p={6} borderRadius="md" bg="orange.50">
          <Heading size="md" color="orange.600" mb={4}>
            🏭 Production Considerations
          </Heading>
          
          <VStack spacing={3} align="stretch" fontSize="sm">
            <Text><strong>For production use:</strong></Text>
            <UnorderedList spacing={1} ml={6}>
              <ListItem>Don't use temporary access tokens - they expire in 24 hours</ListItem>
              <ListItem>Set up a System User with permanent access token</ListItem>
              <ListItem>Consider using a Business Solution Provider (BSP) for enterprise needs</ListItem>
              <ListItem>Implement proper error handling and retry logic</ListItem>
              <ListItem>Monitor your message quality rating to avoid restrictions</ListItem>
            </UnorderedList>
          </VStack>
        </Box>

        <Alert status="success">
          <AlertIcon />
          <Text>
            <strong>Need more help?</strong> Check the WhatsApp Business API documentation at 
            developers.facebook.com/docs/whatsapp or contact Meta support through your 
            Business Manager account.
          </Text>
        </Alert>
      </VStack>
    </Box>
  );
};

export default WhatsAppTroubleshooting;
