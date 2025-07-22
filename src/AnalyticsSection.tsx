import React from 'react';
import { Box, Heading, VStack } from '@chakra-ui/react';
import ReportsTab from './ReportsTab';

const AnalyticsSection: React.FC = () => {
  return (
    <Box w="full" h="full" p={6}>
      <VStack spacing={6} align="stretch" h="full">
        <Heading size="lg" color="blue.600">
          Analytics & Reports
        </Heading>
        
        <Box flex="1" overflow="auto">
          <ReportsTab />
        </Box>
      </VStack>
    </Box>
  );
};

export default AnalyticsSection; 