import { useState, useRef, useEffect } from 'react';
import {
  ChakraProvider,
  Box,
  VStack,
  HStack,
  Heading,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Button,
  useToast,
  Container,
  Text,
  Divider,
  Checkbox,
  Select,
  Alert,
  AlertIcon,
  AlertDescription,
  Collapse,
  useDisclosure,
  Badge,
  Code,
} from '@chakra-ui/react';
import axios from 'axios';
import ReportsTab from './ReportsTab';

function App() {
  // Core messaging states
  const [accessToken, setAccessToken] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('725999993024554');
  const [templateName, setTemplateName] = useState('');
  const [templateLanguage, setTemplateLanguage] = useState('en');
  const [phoneNumbers, setPhoneNumbers] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastMessageIds, setLastMessageIds] = useState<string[]>([]);
  
  // Campaign states
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('new');
  const [campaignName, setCampaignName] = useState('');
  const [campaignDescription, setCampaignDescription] = useState('');
  const [campaignId, setCampaignId] = useState<number | null>(null);
  
  // Template processing states
  const [templateParameters, setTemplateParameters] = useState<string[]>([]);
  const [parameterValues, setParameterValues] = useState<string[]>([]);
  const [simpleMode, setSimpleMode] = useState(true);
  
  // CSV data for names
  const [csvData, setCsvData] = useState<{ name: string; number: string }[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  
  // Test/debug section
  const { isOpen: testSectionOpen, onToggle: toggleTestSection } = useDisclosure();
  
  // Refs
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // Fetch campaigns from the server
  const fetchCampaigns = async () => {
    try {
      const response = await fetch('http://localhost:3001/campaigns');
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data);
        console.log('Campaigns loaded:', data);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    }
  };

  // Create new campaign
  const createCampaign = async () => {
    if (!campaignName.trim()) {
      toast({
        title: 'Campaign name required',
        description: 'Please enter a campaign name',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return null;
    }

    try {
      const response = await fetch('http://localhost:3001/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: campaignName,
          description: campaignDescription,
          templateName: templateName
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCampaignId(data.id);
        fetchCampaigns(); // Refresh campaigns list
        toast({
          title: 'Campaign created',
          description: `Campaign "${campaignName}" created with ID ${data.id}`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        return data.id;
      } else {
        throw new Error('Failed to create campaign');
      }
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast({
        title: 'Error creating campaign',
        description: 'Failed to create campaign. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return null;
    }
  };

  // Load campaigns on component mount
  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Add these new states at the top of the App
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  // Add state for template component detection
  const [templateHasHeader, setTemplateHasHeader] = useState(false);
  const [templateHasImageHeader, setTemplateHasImageHeader] = useState(false);
  const [templateImageHeaderNeedsParams, setTemplateImageHeaderNeedsParams] = useState(false);

  // CSV upload and processing
  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select a CSV or TXT file.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const lines = content.trim().split('\n');
        
        if (lines.length < 2) {
      toast({
            title: 'Invalid CSV format',
            description: 'CSV must contain at least a header row and one data row.',
            status: 'error',
        duration: 5000,
        isClosable: true,
      });
          return;
        }

        const parsedData: { name: string; number: string }[] = [];
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const nameIndex = headers.findIndex(h => h.includes('name'));
        const numberIndex = headers.findIndex(h => h.includes('number') || h.includes('phone'));
        
        if (nameIndex === -1 || numberIndex === -1) {
      toast({
            title: 'Invalid CSV format',
            description: 'CSV must contain columns with "name" and "number" (or "phone") in the headers.',
        status: 'error',
            duration: 5000,
        isClosable: true,
      });
          return;
        }

        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(',').map(cell => cell.trim().replace(/^["']|["']$/g, ''));
          if (row.length >= Math.max(nameIndex, numberIndex) + 1) {
            const name = row[nameIndex]?.trim();
            const number = row[numberIndex]?.trim();
            if (name && number) {
              parsedData.push({ name, number });
            }
          }
        }

        if (parsedData.length === 0) {
      toast({
            title: 'No valid data found',
            description: 'No valid name-number pairs found in the CSV.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

        setCsvData(parsedData);
        setCsvFileName(file.name);
        
        // Auto-populate phone numbers from CSV
        const numbers = parsedData.map(item => item.number).join('\n');
        setPhoneNumbers(numbers);

        toast({
          title: 'CSV loaded successfully',
          description: `Loaded ${parsedData.length} name-number pairs from ${file.name}`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      } catch (error) {
        toast({
          title: 'Error parsing CSV',
          description: 'Failed to parse the CSV file. Please check the format.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    };

    reader.readAsText(file);
  };

  // Add this function inside App
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageUploadLoading(true);
    setImageUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'image');
      formData.append('messaging_product', 'whatsapp'); // Required by WhatsApp API
      // WhatsApp API expects the file field to be named 'file'
      const response = await axios.post(
        `https://graph.facebook.com/v19.0/${phoneNumberId}/media`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      setMediaId(response.data.id);
      toast({
        title: 'Image uploaded',
        description: `media_id: ${response.data.id}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error: any) {
      setImageUploadError(error.response?.data?.error?.message || error.message);
      toast({
        title: 'Image upload failed',
        description: error.response?.data?.error?.message || error.message,
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
    } finally {
      setImageUploadLoading(false);
    }
  };

  // Template checking
  const checkTemplate = async () => {
    if (!accessToken || !templateName) {
      toast({
        title: 'Missing Information',
        description: 'Please enter both Access Token and Template Name',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    try {
      const businessAccountId = '704635985705044';
      const response = await axios.get(
        `https://graph.facebook.com/v22.0/${businessAccountId}/message_templates`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          params: {
            name: templateName,
            language: templateLanguage
          }
        }
      );
      
      if (response.data.data && response.data.data.length > 0) {
        const template = response.data.data[0];
        
        // Analyze template components
        const headerComponent = template.components?.find((comp: any) => comp.type === 'HEADER');
        
        // Check if template has header component
        const hasHeader = !!headerComponent;
        setTemplateHasHeader(hasHeader);
        
        // Check if header is an image - be more flexible with format detection
        const hasImageHeader = hasHeader && (
          headerComponent.format === 'IMAGE' || 
          headerComponent.format === 'image' ||
          (headerComponent.example && headerComponent.example.header_handle) ||
          (headerComponent.example && headerComponent.example.header_text === undefined)
        );
        setTemplateHasImageHeader(hasImageHeader);
        
        if (hasImageHeader) {
          // FIXED LOGIC: If it's an image header, it ALWAYS needs parameters
          // The previous logic was wrong - image headers always need media_id
          setTemplateImageHeaderNeedsParams(true);
          
          console.log('📋 Template analysis:', {
            hasHeader,
            hasImageHeader,
            needsParams: true,
            headerComponent: headerComponent
          });
        } else {
          setTemplateImageHeaderNeedsParams(false);
        }
        
        // Debug: Log the full template structure
        console.log('🔍 Full template structure:', JSON.stringify(template, null, 2));
        
        // Extract template parameters from BODY component
        const bodyComponent = template.components?.find((comp: any) => comp.type === 'BODY');
        if (bodyComponent && bodyComponent.text) {
          const paramMatches = bodyComponent.text.match(/\{\{(\d+)\}\}/g);
          if (paramMatches) {
            const paramNumbers = paramMatches.map((match: string) => 
              parseInt(match.replace(/\{|\}/g, ''))
            );
            setTemplateParameters(paramNumbers);
            setParameterValues(new Array(paramNumbers.length).fill(''));
          } else {
            setTemplateParameters([]);
            setParameterValues([]);
          }
        }
        
                         let description = `Template "${templateName}" is available in ${templateLanguage}`;
        if (hasHeader) {
          if (hasImageHeader) {
            description += ` (has image header - requires image upload)`;
          } else {
            description += ` (has text header)`;
          }
        } else {
          description += ` (no header)`;
        }
        
        toast({
          title: 'Template Found',
          description: description,
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      } else {
        setTemplateHasHeader(false);
        setTemplateHasImageHeader(false);
        setTemplateImageHeaderNeedsParams(false);
        toast({
          title: 'Template Not Found',
          description: `No template found with name "${templateName}" in language ${templateLanguage}`,
        status: 'error',
        duration: 5000,
          isClosable: true,
        });
      }
    } catch (error: any) {
      setTemplateHasHeader(false);
      setTemplateHasImageHeader(false);
      setTemplateImageHeaderNeedsParams(false);
      toast({
        title: 'Error checking template',
        description: error.response?.data?.error?.message || 'Failed to check template',
        status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    };

  // Message sending
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Handle campaign creation/selection
    let useCampaignId = campaignId;
    if (selectedCampaign === 'new') {
      useCampaignId = await createCampaign();
      if (!useCampaignId) {
        setIsLoading(false);
        return;
      }
    } else if (selectedCampaign !== 'none') {
      useCampaignId = parseInt(selectedCampaign);
    }

    // Validate inputs
    if (!accessToken || !phoneNumberId) {
      toast({
        title: 'Missing Configuration',
        description: 'Please provide Access Token and Phone Number ID',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      setIsLoading(false);
      return;
    }

    if (!templateName.trim()) {
      toast({
        title: 'Missing Template Name',
        description: 'Please enter a template name',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      setIsLoading(false);
      return;
    }

    const numbers = phoneNumbers
      .split('\n')
      .map(num => num.trim().replace(/\s+/g, ''))
      .filter(num => num);

    if (numbers.length === 0) {
      toast({
        title: 'No phone numbers',
        description: 'Please enter at least one phone number',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      setIsLoading(false);
      return;
    }

    // Validate phone numbers format
    const invalidNumbers = numbers.filter(num => {
      const cleaned = num.replace(/[^\d+]/g, '');
      return !cleaned.startsWith('+') || cleaned.length < 10 || cleaned.length > 20;
    });
    
    if (invalidNumbers.length > 0) {
      toast({
        title: 'Invalid Phone Numbers',
        description: `Please use international format (+country code). Invalid: ${invalidNumbers.join(', ')}`,
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
      setIsLoading(false);
      return;
    }

    // Clean phone numbers for WhatsApp API
    const cleanedNumbers = numbers.map(num => {
      return num.replace(/[^\d+]/g, '');
    });

    console.log('📱 Phone numbers to send:', cleanedNumbers);

    try {
      const results = await Promise.all(
        cleanedNumbers.map(async (number) => {
          // Normalize both numbers for matching
          const normalize = (num: string) => {
            let n = num.replace(/[^\d+]/g, '');
            if (!n.startsWith('+')) n = '+' + n;
            return n;
          };
          const normalizedNumber = normalize(number);
          const match = csvData.find(item => {
            const csvNormalized = normalize(item.number);
            console.log('Matching:', { csv: item.number, csvNormalized, send: number, normalizedNumber });
            return csvNormalized === normalizedNumber;
          });
          const recipientName = match?.name || 'User';
          
          // Send template message
          const payload: any = {
            messaging_product: "whatsapp",
            to: number,
            type: "template",
            template: {
              name: templateName,
              language: {
                code: templateLanguage
              }
            }
          };

          // Initialize components array if needed
          if (!payload.template.components) payload.template.components = [];

          // Prepare template parameters
          const templateParams: any[] = [];
          
          // If CSV data is available, use the recipient's name as the first parameter
          if (csvData.length > 0) {
            templateParams.push({
                      type: "text",
              text: recipientName
            });
          }
          
          // Add additional parameters if provided
          if (!simpleMode && templateParameters.length > 0) {
            const additionalParams = parameterValues
              .filter(val => val.trim())
              .map(val => ({
                type: "text",
                text: val.trim()
              }));
            
            // If we already have the name parameter, add additional ones
            if (csvData.length > 0) {
              templateParams.push(...additionalParams);
            } else {
              templateParams.push(...additionalParams);
            }
          }

          // Only add body component if the template expects parameters
          if (templateParameters.length > 0 && templateParams.length > 0) {
            if (!payload.template.components) payload.template.components = [];
            payload.template.components.push({
              type: "body",
              parameters: templateParams
            });
          }

          // Debug: Log template state before building payload
          console.log('🔧 Template state for payload:', {
            templateHasHeader,
            templateHasImageHeader,
            templateImageHeaderNeedsParams,
            mediaId
          });
          
          // CRITICAL FIX: The error says "expected IMAGE, received UNKNOWN"
          // This means the template has an image header but we're not sending the right format
          // Let's force the correct format based on the error message
          
          if (templateHasHeader && templateHasImageHeader) {
            // Image header - ALWAYS needs image parameter
            if (mediaId) {
              payload.template.components.push({
                type: 'header',
                parameters: [
                  {
                    type: 'image',
                    image: { id: mediaId }
                  }
                ]
              });
              console.log('📤 Added image header with media_id:', mediaId);
            } else {
              // No mediaId - this will fail, so let's stop here
          toast({
                title: 'Image Required',
                description: 'This template requires an image. Please upload an image to get a media_id before sending.',
            status: 'error',
        duration: 8000,
        isClosable: true,
      });
      setIsLoading(false);
      return;
    }
          } else if (templateHasHeader && !templateHasImageHeader) {
            // Text header - no parameters
            payload.template.components.push({
              type: 'header',
              parameters: []
            });
            console.log('📤 Added text header (no parameters)');
          } else {
            console.log('📤 No header component added (template has no header)');
          }

          console.log('📨 Sending template message payload:', JSON.stringify(payload, null, 2));
          console.log('Payload being sent:', JSON.stringify(payload, null, 2));

          try {
      const response = await axios.post(
        `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

            console.log(`✅ Template message sent successfully to ${number} (${recipientName}):`, response.data);
            
            // Save delivery status to backend database
            const messageId = response.data.messages?.[0]?.id;
            if (messageId) {
              try {
                await axios.post('http://localhost:3001/webhook', {
                  entry: [{
                    changes: [{
                      field: 'messages',
                      value: {
                        statuses: [{
                          id: messageId,
                          status: 'sent',
                          timestamp: Math.floor(Date.now() / 1000),
                          recipient_id: number,
                          campaign_id: useCampaignId
                        }]
                      }
                    }]
                  }]
                });
                console.log(`📊 Delivery status saved for ${number} (campaign: ${useCampaignId})`);
              } catch (dbError) {
                console.warn('Failed to save delivery status:', dbError);
              }
            }
            
            return { 
              number, 
              success: true, 
              messageId: messageId,
              type: 'template',
              name: recipientName
            };
          } catch (error: any) {
            // On failure, POST a failed status to the backend
            const failedMessageId = `failed_${number}_${Date.now()}`;
            try {
              await axios.post('http://localhost:3001/webhook', {
                entry: [{
                  changes: [{
                    field: 'messages',
                    value: {
                      statuses: [{
                        id: failedMessageId,
                        status: 'failed',
                        timestamp: Math.floor(Date.now() / 1000),
                        recipient_id: number,
                        campaign_id: useCampaignId
                      }]
                    }
                  }]
                }]
              });
              console.log(`📊 Failed delivery status saved for ${number} (campaign: ${useCampaignId})`);
            } catch (dbError) {
              console.warn('Failed to save failed delivery status:', dbError);
            }
            console.error(`❌ Template message failed for ${number} (${recipientName}):`, {
              error: error.response?.data,
              payload: payload,
              recipientName: recipientName
            });
            return { 
              number, 
              success: false, 
              error: error.response?.data?.error?.message || error.message,
              type: 'template',
              name: recipientName
            };
          }
        })
      );

      const successful = results.filter(r => r && r.success === true);
      const failed = results.filter(r => r && r.success === false);
      
      if (successful.length > 0) {
        setLastMessageIds(successful.map(r => r?.messageId).filter(id => id));
      }

      if (failed.length === 0) {
        toast({
          title: 'All messages sent successfully!',
          description: `✅ Sent ${successful.length} messages successfully`,
          status: 'success',
          duration: 8000,
          isClosable: true,
        });
      } else {
        console.error('Failed messages:', failed);
        toast({
          title: 'Some messages failed',
          description: `✅ ${successful.length} sent, ❌ ${failed.length} failed. Check console for details.`,
          status: 'warning',
          duration: 8000,
          isClosable: true,
        });
      }

    } catch (error) {
      toast({
        title: 'Error sending messages',
        description: 'Failed to send messages. Please check your configuration.',
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Reset function
  const resetForm = () => {
    setPhoneNumbers('');
    setTemplateName('');
    setTemplateParameters([]);
    setParameterValues([]);
    setCsvData([]);
    setCsvFileName('');
    setLastMessageIds([]);
    setMediaId(null); // Reset image media ID
    setImageUploadError(null); // Clear image upload error
    setTemplateHasHeader(false);
    setTemplateHasImageHeader(false);
    setTemplateImageHeaderNeedsParams(false);
    // Reset campaign fields
    setSelectedCampaign('new');
    setCampaignName('');
    setCampaignDescription('');
    setCampaignId(null);
  };

  // Test functions for debug section
  const testConnection = async () => {
    if (!phoneNumberId || !accessToken) {
      toast({
        title: 'Missing Information',
        description: 'Please enter both Phone Number ID and Access Token',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    try {
      const response = await axios.get(
        `https://graph.facebook.com/v22.0/${phoneNumberId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        }
      );

        toast({
        title: 'Connection Successful',
        description: `Phone Number ID is valid: ${response.data.display_phone_number || response.data.id}`,
          status: 'success',
        duration: 5000,
          isClosable: true,
        });
    } catch (error: any) {
      toast({
        title: 'Connection Failed',
        description: `${error.response?.status}: ${error.response?.data?.error?.message || 'Invalid Phone Number ID or Access Token'}`,
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
    }
  };

  const findPhoneNumbers = async () => {
    if (!accessToken) {
      toast({
        title: 'Missing Access Token',
        description: 'Please enter your Access Token first',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    try {
      // Try to get phone numbers from the business account
      const businessAccountId = '704635985705044'; // Your WhatsApp Business Account ID
      const response = await axios.get(
        `https://graph.facebook.com/v22.0/${businessAccountId}/phone_numbers`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        }
      );

      console.log('Available phone numbers:', response.data);
      
      if (response.data.data && response.data.data.length > 0) {
        const phoneNumber = response.data.data[0];
        setPhoneNumberId(phoneNumber.id);
        toast({
          title: 'Phone Number Found!',
          description: `Found Phone Number ID: ${phoneNumber.id} (${phoneNumber.display_phone_number})`,
          status: 'success',
          duration: 8000,
          isClosable: true,
        });
      } else {
      toast({
          title: 'No Phone Numbers Found',
          description: 'No phone numbers found in your WhatsApp Business Account',
          status: 'warning',
        duration: 8000,
        isClosable: true,
      });
    }
    } catch (error: any) {
      console.error('Failed to find phone numbers:', error.response?.data);
      toast({
        title: 'Failed to Find Phone Numbers',
        description: `${error.response?.status}: ${error.response?.data?.error?.message || 'Check your Access Token and Business Account ID'}`,
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
    }
  };

  return (
    <ChakraProvider>
      <Container maxW="4xl" py={6}>
        <VStack spacing={6} align="stretch">
          {/* Header */}
          <Box textAlign="center" mb={4}>
            <Heading size="lg" color="blue.600">
              📱 WhatsApp Bulk Messaging
            </Heading>
            <Text color="gray.600" mt={2}>
              Send messages using Meta templates with CSV names
            </Text>
          </Box>

          {/* Configuration Section */}
          <Box border="1px solid" borderColor="gray.200" p={6} borderRadius="md">
            <VStack spacing={4} align="stretch">
              <Heading size="md" color="blue.600">⚙️ Configuration</Heading>
              
              <HStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Access Token</FormLabel>
                <Input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="Enter your WhatsApp Business API access token"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Phone Number ID</FormLabel>
                <Input
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                    placeholder="Enter WhatsApp Business phone number ID"
                />
              </FormControl>
              </HStack>
              
              <Alert status="warning" size="sm">
                <AlertIcon />
                <AlertDescription fontSize="sm">
                  <strong>Phone Number ID Issue Detected:</strong> The current Phone Number ID (725999993024554) is invalid. 
                  Please enter your Access Token and click "Find Phone Numbers" to automatically find the correct ID, 
                  or get it from your WhatsApp Business Manager.
                </AlertDescription>
              </Alert>
            </VStack>
          </Box>

          {/* CSV Upload Section */}
          <Box border="1px solid" borderColor="green.200" p={6} borderRadius="md" bg="green.50">
            <VStack spacing={4} align="stretch">
              <Heading size="md" color="green.600">📁 CSV Upload (Names & Numbers)</Heading>
              
              <HStack spacing={4}>
                <Input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleCsvUpload}
                  ref={csvFileInputRef}
                  display="none"
                />
              <Button
                  colorScheme="green"
                  onClick={() => csvFileInputRef.current?.click()}
                  size="md"
                >
                  Upload CSV File
              </Button>

                {csvFileName && (
                  <Text fontSize="sm" color="green.600" fontWeight="bold">
                    ✅ {csvFileName} ({csvData.length} records)
                  </Text>
                )}
              </HStack>
              
              <Text fontSize="sm" color="gray.600">
                Upload a CSV file with columns: <Code>Name</Code> and <Code>Number</Code> (or <Code>Phone</Code>)
              </Text>
              
              {csvData.length > 0 && (
                <Alert status="info" size="sm">
                  <AlertIcon />
                  <AlertDescription fontSize="sm">
                    <strong>Template Integration:</strong> Names from your CSV will automatically be used as the first parameter in your Meta templates.
                  </AlertDescription>
                </Alert>
              )}
              
              {csvData.length > 0 && (
                <Box border="1px solid" borderColor="gray.200" p={3} borderRadius="md" bg="white">
                  <Text fontSize="sm" fontWeight="bold" mb={2}>Preview:</Text>
                  <VStack align="stretch" spacing={1}>
                    {csvData.slice(0, 5).map((item, index) => (
                      <HStack key={index} fontSize="sm" fontFamily="mono">
                        <Text fontWeight="bold">{item.name}</Text>
                        <Text>→</Text>
                        <Text>{item.number}</Text>
                      </HStack>
                    ))}
                    {csvData.length > 5 && (
                      <Text fontSize="sm" color="gray.500">
                        ...and {csvData.length - 5} more
                      </Text>
                    )}
                  </VStack>
                </Box>
              )}
            </VStack>
          </Box>

          {/* Template Configuration */}
          <Box border="1px solid" borderColor="blue.200" p={6} borderRadius="md">
            <VStack spacing={4} align="stretch">
              <Heading size="md" color="blue.600">📝 Meta Template Configuration</Heading>
              
              <HStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Template Name</FormLabel>
                <Input
                  value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Enter template name"
                />
                </FormControl>
                
                <FormControl>
                  <FormLabel>Language</FormLabel>
                  <Select value={templateLanguage} onChange={(e) => setTemplateLanguage(e.target.value)}>
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="pt_BR">Portuguese (Brazil)</option>
                    <option value="ar">Arabic</option>
                    <option value="hi">Hindi</option>
                  <option value="zh_CN">Chinese (Simplified)</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                </Select>
              </FormControl>

                <Button colorScheme="blue" onClick={checkTemplate}>
                  Check Template
                </Button>
              </HStack>
              
              {templateParameters.length > 0 && (
                <Box border="1px solid" borderColor="blue.200" p={4} borderRadius="md" bg="blue.50">
                  <Text fontSize="sm" fontWeight="bold" mb={2}>Template Parameters:</Text>
                  <VStack spacing={2}>
                        {templateParameters.map((param, index) => (
                      <FormControl key={param}>
                        <FormLabel fontSize="sm">
                          Parameter {param} 
                          {index === 0 && csvData.length > 0 && (
                            <Badge ml={2} colorScheme="green" fontSize="xs">
                              Auto-filled from CSV Names
                            </Badge>
                          )}
                        </FormLabel>
                            <Input
                          size="sm"
                          value={index === 0 && csvData.length > 0 ? 'Names from CSV' : (parameterValues[index] || '')}
                              onChange={(e) => {
                                const newValues = [...parameterValues];
                                newValues[index] = e.target.value;
                                setParameterValues(newValues);
                              }}
                          placeholder={index === 0 && csvData.length > 0 ? 'Names from CSV will be used' : `Value for {{${param}}}`}
                          isDisabled={index === 0 && csvData.length > 0}
                            />
                          </FormControl>
                        ))}
                  </VStack>
                </Box>
              )}

                <Checkbox
                  isChecked={simpleMode}
                  onChange={(e) => setSimpleMode(e.target.checked)}
                >
                Simple mode (send without parameters)
                </Checkbox>

              {/* Image upload - only show if template has image header that needs parameters */}
              {templateHasImageHeader && templateImageHeaderNeedsParams && (
                    <FormControl>
                  <FormLabel>Upload Image for Template Header (required)</FormLabel>
                  <Text fontSize="sm" color="orange.600" mb={2}>
                    This template requires an image. Please upload an image to get a media_id.
                      </Text>
                  <Input type="file" accept="image/*" onChange={handleImageUpload} isDisabled={imageUploadLoading || !accessToken || !phoneNumberId} />
                  {imageUploadLoading && <Text color="blue.500">Uploading image...</Text>}
                  {mediaId && <Text color="green.600">Image uploaded! media_id: <Code>{mediaId}</Code></Text>}
                  {imageUploadError && <Text color="red.500">{imageUploadError}</Text>}
                    </FormControl>
              )}
              
              {/* Show template info */}
              {templateName && (
                <Box bg="gray.50" p={3} borderRadius="md" fontSize="sm">
                  <Text fontWeight="bold">Template Analysis:</Text>
                  <Text>• Has Header: {templateHasHeader ? 'Yes' : 'No'}</Text>
                  {templateHasHeader && (
                    <Text>• Header Type: {templateHasImageHeader ? 'Image' : 'Text'}</Text>
                  )}
                  {templateHasImageHeader && (
                    <Text>• Image Type: {templateImageHeaderNeedsParams ? 'Dynamic (requires upload)' : 'Static'}</Text>
                  )}
                </Box>
              )}
            </VStack>
          </Box>

          {/* Phone Numbers */}
          <Box border="1px solid" borderColor="gray.200" p={6} borderRadius="md">
            <VStack spacing={4} align="stretch">
              <Heading size="md" color="gray.600">📞 Phone Numbers</Heading>
              
              {csvData.length > 0 ? (
                    <Box>
                  <Text fontSize="sm" color="green.600" fontWeight="bold" mb={2}>
                    📊 Numbers from CSV ({csvData.length} total)
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    Phone numbers were automatically populated from your CSV file. You can modify them if needed.
                  </Text>
                    </Box>
              ) : (
                <Text fontSize="sm" color="gray.600">
                  Enter phone numbers in international format (one per line)
                </Text>
              )}
              
              <FormControl isRequired>
                <FormLabel>Phone Numbers</FormLabel>
                          <Textarea
                  value={phoneNumbers}
                  onChange={(e) => setPhoneNumbers(e.target.value)}
                  placeholder="+1234567890&#10;+1987654321&#10;+1555123456"
                  rows={4}
                  fontFamily="mono"
                />
                        </FormControl>

              {phoneNumbers && (
                <Text fontSize="sm" color="blue.600">
                  {phoneNumbers.split('\n').filter(n => n.trim()).length} numbers ready to send
                </Text>
                        )}
                      </VStack>
          </Box>

          {/* Send Button */}
          <HStack spacing={4} justify="center">
                              <Button
              size="lg"
                                colorScheme="green"
              onClick={handleSubmit}
              isLoading={isLoading}
              loadingText="Sending..."
              disabled={!phoneNumbers.trim() || !accessToken || !phoneNumberId}
            >
              🚀 Send Messages
                              </Button>

                                <Button
              size="lg"
                                  variant="outline"
              onClick={resetForm}
                                >
              🔄 Reset
                                </Button>
                            </HStack>

          {/* Test/Debug Section */}
          <Box border="1px solid" borderColor="gray.200" p={4} borderRadius="md" bg="gray.50">
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleTestSection}
              width="full"
            >
              {testSectionOpen ? '🔽 Hide' : '🔧 Show'} Test & Debug Tools
            </Button>
            
            <Collapse in={testSectionOpen} animateOpacity>
              <VStack spacing={4} align="stretch" mt={4}>
                <Divider />
                <Heading size="sm" color="gray.600">🔧 Test & Debug Tools</Heading>
                
                <HStack spacing={2} wrap="wrap">
                  <Button size="sm" colorScheme="blue" onClick={testConnection}>
                    Test Connection
                  </Button>
                  <Button size="sm" colorScheme="green" onClick={findPhoneNumbers}>
                    Find Phone Numbers
                  </Button>
                  <Button size="sm" colorScheme="purple" onClick={checkTemplate}>
                    Check Template
                  </Button>
                  <Button size="sm" colorScheme="orange" onClick={() => {
                    console.log('🔍 Debug Info:');
                    console.log('- Access Token:', accessToken ? 'Set' : 'Not set');
                    console.log('- Phone Number ID:', phoneNumberId);
                    console.log('- Template Name:', templateName);
                    console.log('- Template Language:', templateLanguage);
                    console.log('- Template Parameters:', templateParameters);
                    console.log('- CSV Data:', csvData);
                    console.log('- Phone Numbers:', phoneNumbers);
                    console.log('- Simple Mode:', simpleMode);
                    console.log('- Media ID:', mediaId || 'Not uploaded');
                    console.log('- Template Has Header:', templateHasHeader);
                    console.log('- Template Has Image Header:', templateHasImageHeader);
                    console.log('- Template Image Header Needs Params:', templateImageHeaderNeedsParams);
                  }}>
                    Debug Info
                  </Button>
                </HStack>
                
                {lastMessageIds.length > 0 && (
                  <Box>
                    <Text fontSize="sm" fontWeight="bold" mb={2}>Last Message IDs:</Text>
                    <VStack spacing={1} align="stretch">
                      {lastMessageIds.slice(0, 5).map((id, index) => (
                        <Text key={index} fontSize="xs" fontFamily="mono" color="gray.600">
                          {id}
                        </Text>
                      ))}
                      {lastMessageIds.length > 5 && (
                        <Text fontSize="xs" color="gray.500">
                          ...and {lastMessageIds.length - 5} more
                        </Text>
                        )}
                      </VStack>
                    </Box>
                  )}
                </VStack>
            </Collapse>
              </Box>

          {/* Campaign Configuration */}
          <Box border="1px solid" borderColor="purple.200" p={6} borderRadius="md" bg="purple.50">
            <VStack spacing={4} align="stretch">
              <Heading size="md" color="purple.600">🎯 Campaign Configuration</Heading>
              
              <FormControl>
                <FormLabel>Campaign Selection</FormLabel>
                <Select 
                  value={selectedCampaign} 
                  onChange={(e) => setSelectedCampaign(e.target.value)}
                >
                  <option value="new">➕ Create New Campaign</option>
                  <option value="none">📤 No Campaign (Individual Messages)</option>
                  {campaigns.map(campaign => (
                    <option key={campaign.id} value={campaign.id}>
                      🎯 {campaign.name} (ID: {campaign.id})
                    </option>
                  ))}
                </Select>
              </FormControl>
              
              {selectedCampaign === 'new' && (
                <Box border="1px solid" borderColor="purple.200" p={4} borderRadius="md" bg="purple.100">
                  <VStack spacing={3}>
                    <FormControl isRequired>
                      <FormLabel>Campaign Name</FormLabel>
                      <Input
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        placeholder="Enter campaign name (e.g., 'Holiday Promotion 2024')"
                        bg="white"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Campaign Description</FormLabel>
                      <Textarea
                        value={campaignDescription}
                        onChange={(e) => setCampaignDescription(e.target.value)}
                        placeholder="Optional description of this campaign..."
                        rows={2}
                        bg="white"
                      />
                    </FormControl>
                    
                    <Alert status="info" size="sm">
                      <AlertIcon />
                      <Text fontSize="sm">
                        Campaign will be created automatically when you send messages. You can track its progress in the Reports section.
                      </Text>
                    </Alert>
                  </VStack>
                </Box>
              )}
              
              {selectedCampaign !== 'new' && selectedCampaign !== 'none' && (
                <Box bg="purple.100" p={3} borderRadius="md">
                  <Text fontSize="sm" fontWeight="bold" color="purple.700">
                    📊 Selected Campaign: {campaigns.find(c => c.id.toString() === selectedCampaign)?.name}
                  </Text>
                  <Text fontSize="xs" color="gray.600">
                    Messages will be added to this existing campaign for tracking.
                  </Text>
                </Box>
              )}
              
              {selectedCampaign === 'none' && (
                <Alert status="warning" size="sm">
                  <AlertIcon />
                  <Text fontSize="sm">
                    Messages will be sent without campaign tracking. Individual message status will still be available in reports.
                  </Text>
                </Alert>
              )}
            </VStack>
          </Box>

          {/* Static Image Template Info */}
          {templateHasImageHeader && !templateImageHeaderNeedsParams && (
            <Alert status="info" mt={2} mb={2}>
              <AlertIcon />
              This template uses a static image. You do not need to upload or provide a media_id. The image will be included automatically.
            </Alert>
          )}
        </VStack>
      </Container>
      <ReportsTab />
    </ChakraProvider>
  );
}

export default App; 