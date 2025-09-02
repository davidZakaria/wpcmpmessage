import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  VStack,
  Heading,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Button,
  useToast,
  HStack,
  Text,
  Select,
  Alert,
  AlertIcon,
  Badge,
  Collapse,
  useDisclosure,
} from '@chakra-ui/react';
import axios from 'axios';

interface CampaignsSectionProps {
  accessToken: string;
  phoneNumberId: string;
}

const CampaignsSection: React.FC<CampaignsSectionProps> = ({ 
  accessToken, 
  phoneNumberId 
}) => {
  // Debug logging for received props
  useEffect(() => {
    console.log('🔄 CampaignsSection received props:');
    console.log('  • Access Token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'Empty');
    console.log('  • Phone Number ID:', phoneNumberId || 'Empty');
  }, [accessToken, phoneNumberId]);

  const [templateName, setTemplateName] = useState('');
  const [templateLanguage, setTemplateLanguage] = useState('en');
  const [phoneNumbers, setPhoneNumbers] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('new');
  const [campaignName, setCampaignName] = useState('');
  
  // CSV data states
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [phoneNumberColumn, setPhoneNumberColumn] = useState<string>('');
  const [recipientNameColumn, setRecipientNameColumn] = useState<string>('');
  const [mediaIdColumn, setMediaIdColumn] = useState<string>('');
  
  // Template processing states
  const [templateParameters, setTemplateParameters] = useState<string[]>([]);
  const [parameterValues, setParameterValues] = useState<string[]>([]);
  const [templateHasImageHeader, setTemplateHasImageHeader] = useState(false);
  const [templateImageHeaderNeedsParams, setTemplateImageHeaderNeedsParams] = useState(false);
  
  // UI states
  const { isOpen: isDebugOpen, onToggle: onDebugToggle } = useDisclosure();
  const [lastMessageIds, setLastMessageIds] = useState<string[]>([]);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const toast = useToast();

  // Load campaigns on mount
  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        const response = await axios.get('http://localhost:3001/campaigns');
        setCampaigns(response.data);
      } catch (error) {
        console.error('Failed to load campaigns:', error);
      }
    };
    loadCampaigns();
  }, []);

  // CSV file handling
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a CSV file',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string;
        const lines = csv.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = lines.slice(1)
          .filter(line => line.trim())
          .map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            const row: any = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });
            return row;
          });

        setCsvHeaders(headers);
        setCsvData(data);
        
        // Auto-select columns based on common naming patterns
        const phoneColumn = headers.find(h => 
          h.toLowerCase().includes('phone') || 
          h.toLowerCase().includes('number') || 
          h.toLowerCase() === 'phone_number'
        );
        const nameColumn = headers.find(h => 
          h.toLowerCase().includes('name') || 
          h.toLowerCase().includes('recipient')
        );
        
        if (phoneColumn) setPhoneNumberColumn(phoneColumn);
        if (nameColumn) setRecipientNameColumn(nameColumn);

        toast({
          title: 'CSV uploaded successfully',
          description: `Loaded ${data.length} records with ${headers.length} columns`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } catch (error) {
        toast({
          title: 'Error parsing CSV',
          description: 'Please check your CSV format',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    };
    reader.readAsText(file);
  };

  // Template parameter detection
  const extractTemplateParameters = async () => {
    if (!templateName.trim() || !accessToken || !phoneNumberId) {
      toast({
        title: 'Missing Information',
        description: 'Please ensure Template Name, Access Token, and Phone Number ID are provided',
        status: 'warning',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    try {
      // First try to get all templates to verify the API works
      const response = await axios.get(`https://graph.facebook.com/v22.0/${phoneNumberId}/message_templates`, {
        params: {
          access_token: accessToken,
          limit: 250
        }
      });

      const allTemplates = response.data.data || [];
      console.log('📋 Available templates:', allTemplates.map((t: any) => t.name));
      
      // Find the specific template
      const template = allTemplates.find((t: any) => 
        t.name.toLowerCase() === templateName.toLowerCase() && 
        t.language === templateLanguage
      );

      if (template) {
        const components = template.components || [];
        
        let params: string[] = [];
        let hasImageHeader = false;
        let imageHeaderNeedsParams = false;

        components.forEach((component: any) => {
          if (component.type === 'HEADER') {
            if (component.format === 'IMAGE') {
              hasImageHeader = true;
              imageHeaderNeedsParams = component.example && 
                component.example.header_handle && 
                component.example.header_handle.length > 0;
            }
          }
          if (component.type === 'BODY' && component.text) {
            // Count {{1}}, {{2}}, etc. in the body text
            const matches = component.text.match(/\{\{\d+\}\}/g);
            if (matches) {
              params = matches;
            }
          }
        });

        setTemplateParameters(params);
        setParameterValues(new Array(params.length).fill(''));
        setTemplateHasImageHeader(hasImageHeader);
        setTemplateImageHeaderNeedsParams(imageHeaderNeedsParams);

        toast({
          title: 'Template loaded successfully',
          description: `Found template "${template.name}" with ${params.length} parameters`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        setTemplateParameters([]);
        setParameterValues([]);
        setTemplateHasImageHeader(false);
        setTemplateImageHeaderNeedsParams(false);
        
        const availableNames = allTemplates.map((t: any) => t.name).join(', ');
        toast({
          title: 'Template not found',
          description: `Template "${templateName}" not found. Available templates: ${availableNames || 'None'}`,
          status: 'warning',
          duration: 8000,
          isClosable: true,
        });
      }
    } catch (error: any) {
      console.error('❌ Template API Error:', error);
      console.error('❌ Full error response:', error.response);
      setTemplateHasImageHeader(false);
      setTemplateImageHeaderNeedsParams(false);
      
      let errorMessage = 'Failed to check template';
      let errorTitle = 'API Error';
      
      if (error.response?.status === 400) {
        const errorCode = error.response?.data?.error?.code;
        const errorSubcode = error.response?.data?.error?.error_subcode;
        
        console.log('🔍 Error details:', {
          status: error.response.status,
          code: errorCode,
          subcode: errorSubcode,
          message: error.response?.data?.error?.message,
          type: error.response?.data?.error?.type
        });
        
        if (errorCode === 100) {
          errorTitle = '🔐 WhatsApp Business Access Issue';
          errorMessage = 'Your access token lacks WhatsApp Business permissions. Please generate a new token with whatsapp_business_messaging permission from your WhatsApp Business App in Meta Developer Console.';
        } else if (errorCode === 190) {
          errorTitle = '🔑 Access Token Expired';
          errorMessage = 'Your access token has expired. Please generate a new one from Meta Developer Console.';
        } else if (errorCode === 200) {
          errorTitle = '📱 Phone Number Issue';
          errorMessage = 'The Phone Number ID is incorrect or not accessible. Please verify the Phone Number ID from your WhatsApp Business Account.';
        } else {
          errorTitle = '❌ WhatsApp Business API Error';
          errorMessage = `Error ${errorCode}: ${error.response?.data?.error?.message || 'Please check your WhatsApp Business setup and permissions'}`;
        }
      } else if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        status: 'error',
        duration: 10000,
        isClosable: true,
      });
    }
  };

  const createCampaign = async () => {
    try {
      const response = await axios.post('http://localhost:3001/campaigns', {
        name: campaignName.trim() || `Campaign ${Date.now()}`,
        description: ''
      });
      
      const newCampaign = response.data;
      setCampaigns(prev => [...prev, newCampaign]);
      
      toast({
        title: 'Campaign Created',
        description: `Campaign "${newCampaign.name}" created successfully`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      return newCampaign.id;
    } catch (error: any) {
      toast({
        title: 'Failed to create campaign',
        description: error.response?.data?.error || 'Unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Handle campaign creation/selection
    let useCampaignId = null;
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
        description: 'Please provide Access Token and Phone Number ID in the main app',
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

    // Check if we have recipients either from CSV or manual input
    if (csvData.length === 0) {
      const numbers = phoneNumbers
        .split('\n')
        .map(num => num.trim().replace(/\s+/g, ''))
        .filter(num => num);

      if (numbers.length === 0) {
        toast({
          title: 'No phone numbers',
          description: 'Please enter at least one phone number or upload a CSV file',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        setIsLoading(false);
        return;
      }

      // Validate phone numbers format for manual input
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
    } else if (!phoneNumberColumn) {
      toast({
        title: 'Missing Phone Number Column',
        description: 'Please select the phone number column from your CSV file',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      setIsLoading(false);
      return;
    }

    // For getting numbers for validation - only used when not CSV mode
    const numbers = csvData.length === 0 ? phoneNumbers
      .split('\n')
      .map(num => num.trim().replace(/\s+/g, ''))
      .filter(num => num) : [];

    try {
      let messagesToSend: any[] = [];

      if (csvData.length > 0 && phoneNumberColumn) {
        // CSV mode
        messagesToSend = csvData.map(row => ({
          number: row[phoneNumberColumn]?.replace(/[^\d+]/g, ''),
          recipientName: recipientNameColumn ? row[recipientNameColumn] : 'Customer',
          parameterValues: templateParameters.map((_, paramIndex) => {
            const columnName = csvHeaders[paramIndex];
            return columnName && row[columnName] ? row[columnName] : '';
          }),
          mediaId: mediaIdColumn && row[mediaIdColumn] ? row[mediaIdColumn] : null
        }));
      } else {
        // Manual phone numbers mode
        messagesToSend = numbers.map(number => ({
          number: number.replace(/[^\d+]/g, ''),
          recipientName: 'Customer',
          parameterValues: parameterValues,
          mediaId: null
        }));
      }

      // Send messages
      const results = await Promise.all(
        messagesToSend.map(async (msg) => {
          const payload: any = {
            messaging_product: "whatsapp",
            to: msg.number,
            type: "template",
            template: {
              name: templateName,
              language: { code: templateLanguage },
            }
          };

          // Add parameters if template has them
          if (templateParameters.length > 0) {
            payload.template.components = [{
              type: "body",
              parameters: msg.parameterValues.map((value: string) => ({
                type: "text",
                text: value || ""
              }))
            }];
          }

          // Add media header if needed
          if (templateHasImageHeader && templateImageHeaderNeedsParams && msg.mediaId) {
            if (!payload.template.components) {
              payload.template.components = [];
            }
            payload.template.components.unshift({
              type: "header",
              parameters: [{
                type: "image",
                image: {
                  id: msg.mediaId
                }
              }]
            });
          }

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

                          console.log(`✅ Template message sent successfully to ${msg.number} (${msg.recipientName}):`, response.data);
            
            // Save delivery status AND create chat message
            const messageId = response.data.messages?.[0]?.id;
            if (messageId) {
              try {
                // Save to message_status table
                await axios.post('http://localhost:3001/webhook', {
                  entry: [{
                    changes: [{
                      field: 'messages',
                      value: {
                        statuses: [{
                          id: messageId,
                          status: 'sent',
                          timestamp: Math.floor(Date.now() / 1000),
                          recipient_id: msg.number,
                          campaign_id: useCampaignId
                        }]
                      }
                    }]
                  }]
                });
                console.log(`📊 Delivery status saved for ${msg.number} (campaign: ${useCampaignId})`);

                // ALSO save as outgoing chat message for chat center
                const templateText = `Template: ${templateName}` + (csvData.length > 0 ? ` (Sent to: ${msg.recipientName})` : '');
                
                await axios.post('http://localhost:3001/chat/send-message', {
                  to_number: msg.number,
                  text: templateText,
                  access_token: accessToken,
                  phone_number_id: phoneNumberId
                });
                console.log(`💬 Chat message created for campaign to ${msg.number}`);
              } catch (dbError) {
                console.error(`❌ Failed to save delivery status for ${msg.number}:`, dbError);
              }
            }

            return { success: true, number: msg.number, messageId };
          } catch (error: any) {
            console.error(`❌ Failed to send to ${msg.number}:`, error.response?.data || error.message);
            return { 
              success: false, 
              number: msg.number, 
              error: error.response?.data?.error?.message || error.message 
            };
          }
        })
      );

      // Process results
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      setLastMessageIds(successful.map(r => r.messageId).filter(Boolean));

      toast({
        title: `Messages sent: ${successful.length}/${results.length}`,
        description: failed.length > 0 ? `${failed.length} failed to send` : 'All messages sent successfully',
        status: successful.length > 0 ? (failed.length > 0 ? 'warning' : 'success') : 'error',
        duration: 5000,
        isClosable: true,
      });

      if (failed.length > 0) {
        console.error('Failed sends:', failed);
      }

    } catch (error: any) {
      console.error('❌ Submission error:', error);
      toast({
        title: 'Error sending messages',
        description: error.response?.data?.error?.message || error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box w="full" h="full" p={6}>
      <VStack spacing={6} align="stretch">
        <Heading size="lg" color="blue.600">
          📢 Campaign Manager
        </Heading>

        <Box maxW="2xl" mx="auto" w="full">
          <form onSubmit={handleSubmit}>
            <VStack spacing={6} align="stretch">

              {/* Template Configuration */}
              <Box border="1px solid" borderColor="green.200" p={6} borderRadius="md" bg="green.50">
                <VStack spacing={4} align="stretch">
                  <Heading size="md" color="green.600">📝 Template Configuration</Heading>
                  
                  <HStack spacing={4}>
                    <FormControl isRequired>
                      <FormLabel>Template Name</FormLabel>
                      <Input
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="Enter template name"
                        bg="white"
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Language</FormLabel>
                      <Select value={templateLanguage} onChange={(e) => setTemplateLanguage(e.target.value)} bg="white">
                        <option value="en">English</option>
                        <option value="ar">Arabic</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="hi">Hindi</option>
                      </Select>
                    </FormControl>
                    
                    <Box pt={7}>
                      <Button 
                        onClick={extractTemplateParameters} 
                        colorScheme="green" 
                        size="sm"
                        isDisabled={!accessToken || !phoneNumberId || !templateName.trim()}
                      >
                        Check Template
                      </Button>
                    </Box>
                  </HStack>
                  
                  {templateParameters.length > 0 && (
                    <Box border="1px solid" borderColor="green.300" p={4} borderRadius="md" bg="green.100">
                      <Text fontWeight="bold" mb={3} color="green.700">Template Parameters:</Text>
                      <VStack spacing={2}>
                        {templateParameters.map((param, index) => (
                          <FormControl key={index}>
                            <FormLabel fontSize="sm">Parameter {index + 1} {param}</FormLabel>
                            <Input
                              value={parameterValues[index] || ''}
                              onChange={(e) => {
                                const newValues = [...parameterValues];
                                newValues[index] = e.target.value;
                                setParameterValues(newValues);
                              }}
                              placeholder={`Enter value for ${param}`}
                              bg="white"
                              size="sm"
                            />
                          </FormControl>
                        ))}
                      </VStack>
                    </Box>
                  )}
                </VStack>
              </Box>

              {/* Recipients */}
              <Box border="1px solid" borderColor="orange.200" p={6} borderRadius="md" bg="orange.50">
                <VStack spacing={4} align="stretch">
                  <Heading size="md" color="orange.600">👥 Recipients</Heading>
                  
                  {/* CSV Upload */}
                  <Box>
                    <FormLabel>Upload CSV File (Optional)</FormLabel>
                    <HStack spacing={4}>
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        display="none"
                      />
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        colorScheme="orange"
                        variant="outline"
                        size="sm"
                      >
                        Choose CSV File
                      </Button>
                      {csvData.length > 0 && (
                        <Badge colorScheme="green">
                          {csvData.length} records loaded
                        </Badge>
                      )}
                    </HStack>
                  </Box>

                  {csvData.length > 0 && (
                    <Box border="1px solid" borderColor="orange.300" p={4} borderRadius="md" bg="orange.100">
                      <Text fontWeight="bold" mb={3} color="orange.700">CSV Column Mapping:</Text>
                      <HStack spacing={4}>
                        <FormControl>
                          <FormLabel fontSize="sm">Phone Number Column</FormLabel>
                          <Select 
                            value={phoneNumberColumn} 
                            onChange={(e) => setPhoneNumberColumn(e.target.value)}
                            bg="white"
                            size="sm"
                          >
                            <option key="phone-empty" value="">Select column</option>
                            {csvHeaders.filter(header => header.trim()).map((header, index) => (
                              <option key={`phone-${index}-${header}`} value={header}>{header}</option>
                            ))}
                          </Select>
                        </FormControl>
                        
                        <FormControl>
                          <FormLabel fontSize="sm">Recipient Name Column</FormLabel>
                          <Select 
                            value={recipientNameColumn} 
                            onChange={(e) => setRecipientNameColumn(e.target.value)}
                            bg="white"
                            size="sm"
                          >
                            <option key="name-empty" value="">Select column</option>
                            {csvHeaders.filter(header => header.trim()).map((header, index) => (
                              <option key={`name-${index}-${header}`} value={header}>{header}</option>
                            ))}
                          </Select>
                        </FormControl>
                        
                        {templateHasImageHeader && templateImageHeaderNeedsParams && (
                          <FormControl>
                            <FormLabel fontSize="sm">Media ID Column</FormLabel>
                            <Select 
                              value={mediaIdColumn} 
                              onChange={(e) => setMediaIdColumn(e.target.value)}
                              bg="white"
                              size="sm"
                            >
                              <option key="media-empty" value="">Select column</option>
                              {csvHeaders.filter(header => header.trim()).map((header, index) => (
                                <option key={`media-${index}-${header}`} value={header}>{header}</option>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                      </HStack>
                    </Box>
                  )}

                  {/* Manual phone numbers */}
                  {csvData.length === 0 && (
                    <FormControl isRequired>
                      <FormLabel>Phone Numbers (one per line)</FormLabel>
                      <Textarea
                        value={phoneNumbers}
                        onChange={(e) => setPhoneNumbers(e.target.value)}
                        placeholder="+1234567890&#10;+9876543210&#10;..."
                        rows={6}
                        bg="white"
                      />
                    </FormControl>
                  )}
                </VStack>
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
                      bg="white"
                    >
                      <option value="new">➕ Create New Campaign</option>
                      <option value="none">📤 No Campaign</option>
                      {campaigns.map(campaign => (
                        <option key={campaign.id} value={campaign.id}>
                          🎯 {campaign.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  
                  {selectedCampaign === 'new' && (
                    <FormControl isRequired>
                      <FormLabel>Campaign Name</FormLabel>
                      <Input
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        placeholder="Enter campaign name"
                        bg="white"
                      />
                    </FormControl>
                  )}
                </VStack>
              </Box>

              {/* Submit Button */}
              <Button
                type="submit"
                colorScheme="blue"
                size="lg"
                isLoading={isLoading}
                loadingText="Sending messages..."
              >
                Send Template Messages
              </Button>

              {/* Debug Info */}
              <Box>
                <Button onClick={onDebugToggle} size="sm" variant="ghost">
                  🔍 Debug & Test Tools
                </Button>
                
                <Collapse in={isDebugOpen}>
                  <VStack spacing={4} align="stretch" mt={4} p={4} bg="gray.50" borderRadius="md">
                    
                    {/* API Credentials Test */}
                    <Box border="1px solid" borderColor="blue.200" p={4} borderRadius="md" bg="blue.50">
                      <Text fontSize="sm" fontWeight="bold" mb={3} color="blue.700">🔐 API Credentials Test</Text>
                                             <VStack spacing={3} align="stretch">
                         <HStack spacing={4}>
                             <Button 
                               size="sm" 
                               colorScheme="blue" 
                               variant="outline"
                               onClick={async () => {
                                 if (!accessToken || !phoneNumberId) {
                                   toast({
                                     title: 'Missing Credentials',
                                     description: 'Please configure Access Token and Phone Number ID first',
                                     status: 'warning',
                                     duration: 3000,
                                     isClosable: true,
                                   });
                                   return;
                                 }
                                 
                                 try {
                                   const response = await axios.get(`https://graph.facebook.com/v22.0/${phoneNumberId}`, {
                                     params: { access_token: accessToken }
                                   });
                                   console.log('📞 Phone Number Details:', response.data);
                                   toast({
                                     title: '✅ Phone Number ID Valid',
                                     description: `Connected to: ${response.data.display_phone_number || phoneNumberId}`,
                                     status: 'success',
                                     duration: 5000,
                                     isClosable: true,
                                   });
                                 } catch (error: any) {
                                   console.error('❌ Phone ID test failed:', error.response?.data || error);
                                   toast({
                                     title: '❌ Phone Number ID Invalid',
                                     description: error.response?.data?.error?.message || 'Failed to validate',
                                     status: 'error',
                                     duration: 5000,
                                     isClosable: true,
                                   });
                                 }
                               }}
                               isDisabled={!accessToken || !phoneNumberId}
                             >
                               Test Phone ID
                             </Button>
                          
                          <Button 
                            size="sm" 
                            colorScheme="green" 
                            variant="outline"
                            onClick={async () => {
                              if (!accessToken || !phoneNumberId) {
                                toast({
                                  title: 'Missing Credentials',
                                  description: 'Please configure Access Token and Phone Number ID first',
                                  status: 'warning',
                                  duration: 3000,
                                  isClosable: true,
                                });
                                return;
                              }
                              
                              try {
                                // First test basic token validity
                                console.log('🔍 Testing Access Token...');
                                const meResponse = await axios.get('https://graph.facebook.com/v22.0/me', {
                                  params: { access_token: accessToken }
                                });
                                console.log('✅ Token is valid for user:', meResponse.data);
                                
                                // Test template access
                                console.log('🔍 Testing template access...');
                                const templateResponse = await axios.get(`https://graph.facebook.com/v22.0/${phoneNumberId}/message_templates`, {
                                  params: { 
                                    access_token: accessToken,
                                    limit: 5
                                  }
                                });
                                const templates = templateResponse.data.data || [];
                                console.log('✅ Templates accessed successfully:', templates);
                                
                                toast({
                                  title: '✅ Access Token Valid',
                                  description: `Found ${templates.length} templates. Token permissions are correct.`,
                                  status: 'success',
                                  duration: 5000,
                                  isClosable: true,
                                });
                              } catch (error: any) {
                                console.error('❌ Token test failed:', error.response?.data || error);
                                
                                let errorTitle = '❌ Access Token Invalid';
                                let errorDescription = 'Token lacks required permissions';
                                
                                if (error.response?.data?.error) {
                                  const apiError = error.response.data.error;
                                  console.log('📋 API Error Details:', apiError);
                                  
                                  if (apiError.code === 100) {
                                    errorTitle = '❌ WhatsApp Business Access Issue';
                                    errorDescription = 'Phone Number ID may be incorrect or token lacks WhatsApp Business permissions';
                                  } else if (apiError.code === 190) {
                                    errorTitle = '❌ Access Token Expired';
                                    errorDescription = 'Please generate a new access token from Meta Developer Console';
                                  } else {
                                    errorDescription = apiError.message || errorDescription;
                                  }
                                }
                                
                                toast({
                                  title: errorTitle,
                                  description: errorDescription,
                                  status: 'error',
                                  duration: 8000,
                                  isClosable: true,
                                });
                              }
                            }}
                            isDisabled={!accessToken || !phoneNumberId}
                          >
                            Test Access Token
                          </Button>
                          
                                                     <Button 
                             size="sm" 
                             colorScheme="purple" 
                             variant="outline"
                             onClick={async () => {
                               if (!accessToken || !phoneNumberId) return;
                               
                               try {
                                 const response = await axios.get(`https://graph.facebook.com/v22.0/${phoneNumberId}/message_templates`, {
                                   params: { 
                                     access_token: accessToken,
                                     limit: 50
                                   }
                                 });
                                                                 const templates = response.data.data || [];
                                console.log('📋 All Templates:', templates);
                                
                                templates.forEach((t: any) => {
                                  console.log(`• ${t.name} (${t.language}) - Status: ${t.status}`);
                                });
                                
                                toast({
                                   title: `📋 Found ${templates.length} Templates`,
                                   description: templates.length > 0 ? 
                                     'Check console for full list' : 
                                     'No templates found',
                                   status: 'info',
                                   duration: 5000,
                                   isClosable: true,
                                 });
                               } catch (error: any) {
                                 console.error('Template fetch error:', error);
                               }
                             }}
                             isDisabled={!accessToken || !phoneNumberId}
                           >
                             List All Templates
                           </Button>
                         </HStack>
                         
                         {/* Full Diagnostic Button */}
                         <Button 
                           size="sm" 
                           colorScheme="red" 
                           variant="solid"
                           onClick={async () => {
                             if (!accessToken || !phoneNumberId) return;
                             
                             console.log('🔬 Starting Full WhatsApp Business Diagnostic...');
                             console.log('='.repeat(50));
                             
                             const diagnostics: {
                               tokenValid: boolean;
                               phoneIdValid: boolean;
                               templatesAccessible: boolean;
                               appType: string;
                               permissions: string[];
                               errors: string[];
                             } = {
                               tokenValid: false,
                               phoneIdValid: false,
                               templatesAccessible: false,
                               appType: 'Unknown',
                               permissions: [],
                               errors: []
                             };
                             
                             try {
                               // Step 1: Basic token validation
                               console.log('1️⃣ Testing basic token validity...');
                               const meResponse = await axios.get('https://graph.facebook.com/v22.0/me', {
                                 params: { access_token: accessToken }
                               });
                               diagnostics.tokenValid = true;
                               console.log('✅ Token is valid for:', meResponse.data);
                               
                               // Step 2: Test phone number access
                               console.log('2️⃣ Testing phone number ID access...');
                               try {
                                 const phoneResponse = await axios.get(`https://graph.facebook.com/v22.0/${phoneNumberId}`, {
                                   params: { 
                                     access_token: accessToken,
                                     fields: 'id,display_phone_number,verified_name,code_verification_status,quality_rating'
                                   }
                                 });
                                 diagnostics.phoneIdValid = true;
                                 console.log('✅ Phone number details:', phoneResponse.data);
                               } catch (phoneError: any) {
                                 console.error('❌ Phone ID access failed:', phoneError.response?.data);
                                 diagnostics.errors.push(`Phone ID Error: ${phoneError.response?.data?.error?.message || 'Unknown'}`);
                               }
                               
                               // Step 3: Test WhatsApp Business access
                               console.log('3️⃣ Testing WhatsApp Business API access...');
                               try {
                                 await axios.get(`https://graph.facebook.com/v22.0/${phoneNumberId}/message_templates`, {
                                   params: { 
                                     access_token: accessToken,
                                     limit: 1
                                   }
                                 });
                                 diagnostics.templatesAccessible = true;
                                 console.log('✅ WhatsApp Business API access successful');
                               } catch (templatesError: any) {
                                 console.error('❌ WhatsApp Business API access failed:', templatesError.response?.data);
                                 diagnostics.errors.push(`Templates Error: ${templatesError.response?.data?.error?.message || 'Unknown'}`);
                               }
                               
                               // Step 4: Check app permissions
                               console.log('4️⃣ Checking app permissions...');
                               try {
                                 const appResponse = await axios.get(`https://graph.facebook.com/v22.0/${meResponse.data.id}/permissions`, {
                                   params: { access_token: accessToken }
                                 });
                                 diagnostics.permissions = appResponse.data.data.map((p: any) => p.permission);
                                 console.log('📋 App permissions:', diagnostics.permissions);
                               } catch (permError: any) {
                                 console.log('⚠️ Could not fetch permissions:', permError.response?.data);
                               }
                               
                                                               console.log('='.repeat(50));
                                console.log('📊 DIAGNOSTIC SUMMARY:');
                                console.log('Token Valid:', diagnostics.tokenValid);
                                console.log('Phone ID Valid:', diagnostics.phoneIdValid);  
                                console.log('WhatsApp Business Access:', diagnostics.templatesAccessible);
                                console.log('');
                                console.log('📋 DETAILED PERMISSIONS:');
                                diagnostics.permissions.forEach((perm, index) => {
                                  console.log(`  ${index + 1}. ${perm}`);
                                });
                                console.log('');
                                console.log('❌ DETAILED ERRORS:');
                                diagnostics.errors.forEach((error, index) => {
                                  console.log(`  ${index + 1}. ${error}`);
                                });
                                console.log('');
                                console.log('🎯 REQUIRED PERMISSIONS FOR WHATSAPP:');
                                const requiredPerms = [
                                  'whatsapp_business_messaging',
                                  'whatsapp_business_management', 
                                  'business_management',
                                  'pages_messaging',
                                  'pages_read_engagement'
                                ];
                                const missingPerms: string[] = [];
                                requiredPerms.forEach((perm) => {
                                  const hasPermission = diagnostics.permissions.includes(perm);
                                  console.log(`  ${hasPermission ? '✅' : '❌'} ${perm}`);
                                  if (!hasPermission) missingPerms.push(perm);
                                });
                                
                                console.log('');
                                console.log('💡 NEXT STEPS TO FIX:');
                                if (diagnostics.tokenValid && diagnostics.phoneIdValid && !diagnostics.templatesAccessible) {
                                  console.log('  🔥 PERMISSION ISSUE DETECTED!');
                                  console.log('  📋 Your access token works but lacks WhatsApp Business permissions.');
                                  console.log('  🎯 SOLUTION:');
                                  console.log('     1. Go to developers.facebook.com');
                                  console.log('     2. Select your WhatsApp Business App (not regular Facebook app)');
                                  console.log('     3. Generate new access token with these permissions:');
                                  missingPerms.forEach(perm => console.log(`        • ${perm}`));
                                  console.log('     4. Make sure the phone number is connected to your WhatsApp Business Account');
                                } else if (!diagnostics.tokenValid) {
                                  console.log('  🔥 TOKEN ISSUE DETECTED!');
                                  console.log('  📋 Your access token is invalid or expired.');
                                  console.log('  🎯 SOLUTION: Generate a new access token from Meta Developer Console');
                                } else if (!diagnostics.phoneIdValid) {
                                  console.log('  🔥 PHONE NUMBER ID ISSUE DETECTED!');
                                  console.log('  📋 The phone number ID is incorrect or not accessible.');
                                  console.log('  🎯 SOLUTION: Get the correct Phone Number ID from business.facebook.com');
                                } else {
                                  console.log('  ✅ No obvious issues detected. Check individual test results above.');
                                }
                                console.log('='.repeat(50));
                               
                                                               // Show result toast with specific guidance
                                const issues = diagnostics.errors.length;
                                let toastTitle = '';
                                let toastDescription = '';
                                let toastStatus: 'success' | 'warning' | 'error' = 'success';
                                
                                if (issues === 0) {
                                  toastTitle = '✅ All Systems Good!';
                                  toastDescription = 'WhatsApp Business API setup is correct';
                                  toastStatus = 'success';
                                } else if (diagnostics.tokenValid && diagnostics.phoneIdValid && !diagnostics.templatesAccessible) {
                                  toastTitle = '🔐 Permission Issue Detected';
                                  toastDescription = 'Your token works but lacks WhatsApp Business permissions. Check console for required permissions.';
                                  toastStatus = 'warning';
                                } else if (!diagnostics.phoneIdValid) {
                                  toastTitle = '📱 Phone Number ID Issue';
                                  toastDescription = 'The Phone Number ID may be incorrect or not accessible with your token';
                                  toastStatus = 'error';
                                } else {
                                  toastTitle = `⚠️ Found ${issues} Issue(s)`;
                                  toastDescription = 'Check console for detailed diagnostic results';
                                  toastStatus = 'warning';
                                }
                                
                                toast({
                                  title: toastTitle,
                                  description: toastDescription,
                                  status: toastStatus,
                                  duration: 10000,
                                  isClosable: true,
                                });
                               
                             } catch (error: any) {
                               console.error('❌ Diagnostic failed:', error);
                               toast({
                                 title: '❌ Diagnostic Failed',
                                 description: 'Check console for error details',
                                 status: 'error',
                                 duration: 5000,
                                 isClosable: true,
                               });
                             }
                           }}
                           isDisabled={!accessToken || !phoneNumberId}
                         >
                           🔬 Full Diagnostic
                         </Button>
                        
                        {/* Credential Display */}
                        <Box bg="gray.100" p={3} borderRadius="md">
                          <VStack spacing={2} align="stretch" fontSize="xs">
                            <HStack justify="space-between">
                              <Text fontWeight="bold">Phone Number ID:</Text>
                              <Text fontFamily="mono" color="blue.600">
                                {phoneNumberId || 'Not configured'}
                              </Text>
                            </HStack>
                            <HStack justify="space-between">
                              <Text fontWeight="bold">Access Token:</Text>
                              <Text fontFamily="mono" color="green.600">
                                {accessToken ? `${accessToken.substring(0, 20)}...` : 'Not configured'}
                              </Text>
                            </HStack>
                          </VStack>
                        </Box>
                      </VStack>
                    </Box>

                    {/* Message IDs */}
                    {lastMessageIds.length > 0 && (
                      <Box border="1px solid" borderColor="green.200" p={4} borderRadius="md" bg="green.50">
                        <Text fontSize="sm" fontWeight="bold" mb={2} color="green.700">📨 Recent Message IDs:</Text>
                        <VStack spacing={1} align="stretch">
                          {lastMessageIds.slice(0, 5).map((id, index) => (
                            <HStack key={index} justify="space-between">
                              <Text fontSize="xs" fontFamily="mono" color="gray.600">
                                {id}
                              </Text>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => {
                                  navigator.clipboard.writeText(id);
                                  toast({
                                    title: 'Copied!',
                                    description: 'Message ID copied to clipboard',
                                    status: 'success',
                                    duration: 2000,
                                    isClosable: true,
                                  });
                                }}
                              >
                                📋 Copy
                              </Button>
                            </HStack>
                          ))}
                          {lastMessageIds.length > 5 && (
                            <Text fontSize="xs" color="gray.500">
                              ...and {lastMessageIds.length - 5} more
                            </Text>
                          )}
                        </VStack>
                      </Box>
                    )}

                    {/* System Info */}
                    <Box border="1px solid" borderColor="gray.300" p={4} borderRadius="md" bg="gray.100">
                      <Text fontSize="sm" fontWeight="bold" mb={2} color="gray.700">⚙️ System Info:</Text>
                      <VStack spacing={1} align="stretch" fontSize="xs" color="gray.600">
                        <Text>• CSV Records: {csvData.length}</Text>
                        <Text>• Template Parameters: {templateParameters.length}</Text>
                        <Text>• CSV Headers: {csvHeaders.join(', ') || 'None'}</Text>
                        <Text>• Timestamp: {new Date().toLocaleString()}</Text>
                      </VStack>
                    </Box>
                  </VStack>
                </Collapse>
              </Box>

              {/* Static Image Template Info */}
              {templateHasImageHeader && !templateImageHeaderNeedsParams && (
                <Alert status="info">
                  <AlertIcon />
                  This template uses a static image. The image will be included automatically.
                </Alert>
              )}

              {/* Credentials Status */}
              {!accessToken || !phoneNumberId ? (
                <Alert status="warning">
                  <AlertIcon />
                  <VStack spacing={2} align="start">
                    <Text fontSize="sm" fontWeight="bold">
                      API Configuration Required
                    </Text>
                    <Text fontSize="sm">
                      Please configure your credentials using the ⚙️ Settings button in the top-right corner.
                    </Text>
                    <VStack spacing={1} align="start" fontSize="xs" color="gray.600">
                      <Text>• Access Token: {accessToken ? '✅ Configured' : '❌ Missing'}</Text>
                      <Text>• Phone Number ID: {phoneNumberId ? '✅ Configured' : '❌ Missing'}</Text>
                    </VStack>
                  </VStack>
                </Alert>
              ) : (
                <Alert status="info">
                  <AlertIcon />
                  <VStack spacing={1} align="start">
                    <Text fontSize="sm" fontWeight="bold">
                      API Configuration Status
                    </Text>
                    <Text fontSize="sm">
                      ✅ Credentials configured. You can now check templates and send messages.
                    </Text>
                    <Text fontSize="xs" color="gray.600">
                      Phone Number ID: {phoneNumberId}
                    </Text>
                  </VStack>
                </Alert>
              )}
            </VStack>
          </form>
        </Box>
      </VStack>
    </Box>
  );
};

export default CampaignsSection; 