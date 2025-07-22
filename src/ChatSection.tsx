import React from 'react';
import { Box, Heading, VStack } from '@chakra-ui/react';
import ChatTab from './ChatTab';

interface ChatSectionProps {
  accessToken: string;
  phoneNumberId: string;
}

const ChatSection: React.FC<ChatSectionProps> = ({ accessToken, phoneNumberId }) => {
  return (
    <Box w="full" h="full" p={6}>
      <VStack spacing={6} align="stretch" h="full">
        <Heading size="lg" color="blue.600">
          WhatsApp Chat Center
        </Heading>
        
        <Box flex="1" overflow="hidden">
          <ChatTab 
            accessToken={accessToken} 
            phoneNumberId={phoneNumberId} 
          />
        </Box>
      </VStack>
    </Box>
  );
};

export default ChatSection; 