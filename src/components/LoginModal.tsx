// Login Modal Component
// Handles user authentication

import React, { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  FormControl,
  FormLabel,
  Input,
  Button,
  Alert,
  AlertIcon,
  Text,
  Divider,
  HStack,
  Icon,
  useToast
} from '@chakra-ui/react';
import { FaUser, FaLock, FaSignInAlt } from 'react-icons/fa';
import { userManagementService } from '../services/userManagementService';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: any) => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const authToken = await userManagementService.login({ email, password });
      
      toast({
        title: 'Login Successful',
        description: `Welcome back, ${authToken.user.name}!`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      onLoginSuccess(authToken.user);
      onClose();
      
      // Reset form
      setEmail('');
      setPassword('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setEmail('demo@socialmoderator.com');
    setPassword('demo123');
    await handleLogin();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <HStack>
            <Icon as={FaSignInAlt} color="blue.500" />
            <Text>Sign In to Social Moderator</Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody pb={6}>
          <VStack spacing={4}>
            {error && (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                {error}
              </Alert>
            )}

            <FormControl>
              <FormLabel>
                <HStack>
                  <Icon as={FaUser} />
                  <Text>Email</Text>
                </HStack>
              </FormLabel>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              />
            </FormControl>

            <FormControl>
              <FormLabel>
                <HStack>
                  <Icon as={FaLock} />
                  <Text>Password</Text>
                </HStack>
              </FormLabel>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              />
            </FormControl>

            <Button
              colorScheme="blue"
              width="full"
              onClick={handleLogin}
              isLoading={isLoading}
              loadingText="Signing in..."
            >
              Sign In
            </Button>

            <Divider />

            <VStack spacing={2} width="full">
              <Text fontSize="sm" color="gray.500">
                Try the demo:
              </Text>
              <Button
                variant="outline"
                colorScheme="green"
                width="full"
                onClick={handleDemoLogin}
                isDisabled={isLoading}
              >
                Demo Login
              </Button>
            </VStack>

            <VStack spacing={1} pt={4}>
              <Text fontSize="xs" color="gray.500" textAlign="center">
                Demo Credentials:
              </Text>
              <Text fontSize="xs" color="gray.400">
                Email: demo@socialmoderator.com
              </Text>
              <Text fontSize="xs" color="gray.400">
                Password: demo123
              </Text>
            </VStack>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default LoginModal;
