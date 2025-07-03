import { useState, useRef } from 'react';
import {
  ChakraProvider,
  Box,
  VStack,
  Heading,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Button,
  useToast,
  Container,
  Text,
  HStack,
  Divider,
} from '@chakra-ui/react';
import axios from 'axios';

function App() {
  const [accessToken, setAccessToken] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      // Split by newline and/or comma, clean up the numbers
      const numbers = text
        .split(/[\n,]+/)
        .map(num => num.trim())
        .filter(num => num && num !== 'phone' && num !== 'phones' && num !== 'number' && num !== 'numbers');
      setPhoneNumbers(numbers.join('\n'));
    };

    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const numbers = phoneNumbers
      .split('\n')
      .map(num => num.trim())
      .filter(num => num);

    if (numbers.length === 0) {
      toast({
        title: 'Error',
        description: 'Please enter at least one phone number',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      setIsLoading(false);
      return;
    }

    try {
      const results = await Promise.all(
        numbers.map(async (number) => {
          const payload = {
            messaging_product: "whatsapp",
            to: number,
            type: "template",
            template: {
              name: templateName,
              language: {
                code: "en_US"
              }
            }
          };

          try {
            await axios.post(
              'https://graph.facebook.com/v22.0/725999913924554/messages',
              payload,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            return { number, success: true };
          } catch (error: any) {
            console.error(`Error sending to ${number}:`, error.response?.data || error.message);
            return { 
              number, 
              success: false, 
              error: error.response?.data?.error?.message || error.message 
            };
          }
        })
      );

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      const failedResults = results.filter(r => !r.success);

      // Log failed results for debugging
      if (failedResults.length > 0) {
        console.error('Failed messages:', failedResults);
      }

      toast({
        title: 'Messages Sent',
        description: `Successfully sent to ${successful} numbers. Failed: ${failed}${
          failedResults.length > 0 ? `. Check console for error details.` : ''
        }`,
        status: successful > 0 ? 'success' : 'error',
        duration: 8000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send messages',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ChakraProvider>
      <Container maxW="container.md" py={10}>
        <VStack spacing={8} align="stretch">
          <Heading textAlign="center">WhatsApp Message Sender</Heading>
          <Box as="form" onSubmit={handleSubmit}>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Access Token</FormLabel>
                <Input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Enter your access token"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Template Name</FormLabel>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Enter template name"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Phone Numbers</FormLabel>
                <VStack align="stretch" spacing={2}>
                  <HStack>
                    <Input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      ref={fileInputRef}
                      display="none"
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      colorScheme="teal"
                      width="full"
                    >
                      Upload CSV/TXT File
                    </Button>
                  </HStack>
                  {fileName && (
                    <Text fontSize="sm" color="gray.600">
                      Uploaded: {fileName}
                    </Text>
                  )}
                  <Divider />
                  <Text fontSize="sm" color="gray.600">
                    Or enter numbers manually (one per line):
                  </Text>
                  <Textarea
                    value={phoneNumbers}
                    onChange={(e) => setPhoneNumbers(e.target.value)}
                    placeholder="Enter phone numbers (one per line)"
                    rows={5}
                  />
                </VStack>
              </FormControl>

              <Button
                type="submit"
                colorScheme="blue"
                width="full"
                isLoading={isLoading}
                loadingText="Sending..."
              >
                Send Messages
              </Button>
            </VStack>
          </Box>
        </VStack>
      </Container>
    </ChakraProvider>
  );
}

export default App; 