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
  Checkbox,
  Select,
  Image,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Link,
} from '@chakra-ui/react';
import axios from 'axios';

function App() {
  const [accessToken, setAccessToken] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('725999913924554');
  const [templateName, setTemplateName] = useState('');
  const [templateLanguage, setTemplateLanguage] = useState('en_US');
  const [hasMedia, setHasMedia] = useState(false);
  const [simpleMode, setSimpleMode] = useState(true);
  const [templateComponents, setTemplateComponents] = useState<any[]>([]);
  const [lastMessageIds, setLastMessageIds] = useState<string[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  // New image-related states
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
  // New direct image message states
  const [sendDirectImage, setSendDirectImage] = useState(false);
  const [imageCaption, setImageCaption] = useState('');
  const [imageOnly, setImageOnly] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

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
      // Test with a simple GET request to verify the phone number exists
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
      console.log('Phone number info:', response.data);
    } catch (error: any) {
      console.error('Connection test failed:', error.response?.data);
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
        description: `${error.response?.status}: ${error.response?.data?.error?.message || 'Check your Access Token'}`,
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
    }
  };

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
      // Get template details from WhatsApp Business API
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
      
      console.log('Template details:', response.data);
      
      if (response.data.data && response.data.data.length > 0) {
        const template = response.data.data[0];
        console.log('Template structure:', template);
        
        // Store template components for later use
        setTemplateComponents(template.components || []);
        
        // Automatically set the correct language
        if (template.language && template.language !== templateLanguage) {
          setTemplateLanguage(template.language);
          toast({
            title: 'Language Updated',
            description: `Template language changed to "${template.language}"`,
            status: 'info',
            duration: 5000,
            isClosable: true,
          });
        }
        
        // Check if template has media
        const hasHeaderMedia = template.components?.some((comp: any) => 
          comp.type === 'HEADER' && (comp.format === 'IMAGE' || comp.format === 'VIDEO' || comp.format === 'DOCUMENT')
        );
        
        if (hasHeaderMedia && !hasMedia) {
          setHasMedia(true);
          toast({
            title: 'Template Has Media',
            description: 'This template contains media. Checkbox has been checked automatically.',
            status: 'info',
            duration: 8000,
            isClosable: true,
          });
        }
        
        toast({
          title: 'Template Found',
          description: `Template "${templateName}" is ${template.status}. Check console for details.`,
          status: 'success',
          duration: 8000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Template Not Found',
          description: `Template "${templateName}" not found in your account`,
          status: 'error',
          duration: 8000,
          isClosable: true,
        });
      }
    } catch (error: any) {
      console.error('Failed to check template:', error.response?.data);
      toast({
        title: 'Failed to Check Template',
        description: `${error.response?.status}: ${error.response?.data?.error?.message || 'Check your Access Token'}`,
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
    }
  };

  const listAllTemplates = async () => {
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
      const businessAccountId = '704635985705044';
      const response = await axios.get(
        `https://graph.facebook.com/v22.0/${businessAccountId}/message_templates`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        }
      );
      
      console.log('📋 All available templates:', response.data);
      
      if (response.data.data && response.data.data.length > 0) {
        const templates = response.data.data;
        console.log('📋 Template List:');
        templates.forEach((template: any, index: number) => {
          console.log(`${index + 1}. Name: "${template.name}", Language: "${template.language}", Status: ${template.status}`);
        });
        
        toast({
          title: 'Templates Found',
          description: `Found ${templates.length} templates. Check console for full list.`,
          status: 'success',
          duration: 8000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'No Templates Found',
          description: 'No templates found in your WhatsApp Business Account',
          status: 'warning',
          duration: 8000,
          isClosable: true,
        });
      }
    } catch (error: any) {
      console.error('Failed to list templates:', error.response?.data);
      toast({
        title: 'Failed to List Templates',
        description: `${error.response?.status}: ${error.response?.data?.error?.message || 'Check your Access Token'}`,
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
    }
  };

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

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid File Type',
        description: 'Please select an image file (PNG, JPG, GIF, etc.)',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    // Validate file size (WhatsApp has a 5MB limit for images)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Image must be smaller than 5MB for WhatsApp',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    setImageFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    toast({
      title: 'Image Selected',
      description: `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };

  const uploadImageToImgBB = async (): Promise<string> => {
    if (!imageFile) throw new Error('No image file selected');

    const formData = new FormData();
    formData.append('image', imageFile);

    try {
      // Using imgbb.com which allows CORS from browsers
      const response = await axios.post('https://api.imgbb.com/1/upload', formData, {
        params: {
          key: 'fa3edc579a0f0b27ccf5e24686bcad6b' // Free public API key
        },
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        const imageUrl = response.data.data.url;
        setUploadedImageUrl(imageUrl);
        toast({
          title: 'Image Uploaded Successfully',
          description: 'Image has been uploaded to imgBB and is ready to send',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
        return imageUrl;
      } else {
        throw new Error('Upload failed');
      }
    } catch (error: any) {
      console.error('Image upload failed:', error);
      
      // Provide more helpful error messages
      if (error.code === 'ERR_NETWORK' || error.message.includes('CORS')) {
        toast({
          title: 'Upload Service Unavailable',
          description: 'Image hosting service is blocked. Please use the manual upload option below.',
          status: 'warning',
          duration: 8000,
          isClosable: true,
        });
      } else if (error.response?.status === 400) {
        toast({
          title: 'Invalid Image',
          description: 'Please check your image format and size (max 32MB)',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Upload Failed',
          description: 'Could not upload image. Please try the manual upload option.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
      
      throw error;
    }
  };

  const uploadImageToPostImage = async (): Promise<string> => {
    if (!imageFile) throw new Error('No image file selected');

    const formData = new FormData();
    formData.append('upload', imageFile);

    try {
      // Using postimages.org as backup
      const response = await axios.post('https://postimages.org/json/rr', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data && response.data.url) {
        const imageUrl = response.data.url;
        setUploadedImageUrl(imageUrl);
        toast({
          title: 'Image Uploaded Successfully',
          description: 'Image has been uploaded to PostImages and is ready to send',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
        return imageUrl;
      } else {
        throw new Error('Upload failed');
      }
    } catch (error: any) {
      console.error('PostImages upload failed:', error);
      throw error;
    }
  };

  const uploadImageWithFallback = async (): Promise<string> => {
    if (!imageFile) throw new Error('No image file selected');

    toast({
      title: 'Uploading Image',
      description: 'Trying to upload your image...',
      status: 'info',
      duration: 3000,
      isClosable: true,
    });

    // Try imgBB first
    try {
      console.log('🔄 Trying imgBB upload...');
      return await uploadImageToImgBB();
    } catch (imgbbError) {
      console.log('❌ imgBB failed, trying PostImages...');
      
      // Try PostImages as fallback
      try {
        return await uploadImageToPostImage();
      } catch (postError) {
        console.log('❌ PostImages also failed');
        
        // Both failed, show manual upload option
        toast({
          title: 'Automatic Upload Failed',
          description: 'Please use the manual upload instructions below',
          status: 'warning',
          duration: 8000,
          isClosable: true,
        });
        
        throw new Error('All upload services failed');
      }
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview('');
    setUploadedImageUrl('');
    setImageUrl('');
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const getImageUrlForTemplate = (): string => {
    if (uploadedImageUrl) return uploadedImageUrl;
    if (imageUrl.trim()) return imageUrl.trim();
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const numbers = phoneNumbers
      .split('\n')
      .map(num => num.trim().replace(/\s+/g, '')) // Remove all spaces from phone numbers
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

    // Validate phone numbers format
    const invalidNumbers = numbers.filter(num => !num.startsWith('+') || num.length < 10);
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

    // Handle image upload if file is selected but not uploaded
    if ((hasMedia && !simpleMode) || sendDirectImage) {
      if (imageFile && !uploadedImageUrl && !imageUrl.trim()) {
        try {
          toast({
            title: 'Uploading Image',
            description: 'Uploading your image to hosting service...',
            status: 'info',
            duration: 3000,
            isClosable: true,
          });
          await uploadImageWithFallback();
        } catch (error) {
          toast({
            title: 'Image Upload Failed',
            description: 'Failed to upload image. Please try again or provide a direct image URL.',
            status: 'error',
            duration: 8000,
            isClosable: true,
          });
          setIsLoading(false);
          return;
        }
      }
    }

    // Validate image URL if media template is selected
    if (hasMedia && !simpleMode && !getImageUrlForTemplate()) {
      toast({
        title: 'Image Required',
        description: 'Template contains media but no image URL provided. Please upload an image or provide an image URL.',
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
      setIsLoading(false);
      return;
    }

    // Validate image URL if sending direct image
    if (sendDirectImage && !getImageUrlForTemplate()) {
      toast({
        title: 'Image Required',
        description: 'Direct image sending is enabled but no image URL provided. Please upload an image or provide an image URL.',
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
      setIsLoading(false);
      return;
    }

    // Validate template name if not sending image only
    if (!imageOnly && !templateName.trim()) {
      toast({
        title: 'Template Name Required',
        description: 'Please enter a template name or enable "Send Image Only" mode.',
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
      setIsLoading(false);
      return;
    }

    // Validate API configuration
    if (!phoneNumberId || phoneNumberId.length < 10) {
      toast({
        title: 'Invalid Phone Number ID',
        description: 'Phone Number ID should be a long numeric string (15+ digits)',
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
      setIsLoading(false);
      return;
    }

    if (!accessToken || accessToken.length < 50) {
      toast({
        title: 'Invalid Access Token',
        description: 'Access Token seems too short. Please check your token.',
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
      setIsLoading(false);
      return;
    }

    try {
      const results = await Promise.all(
        numbers.map(async (number) => {
          // Check if sending direct image message
          if (sendDirectImage && getImageUrlForTemplate()) {
            const imagePayload: any = {
              messaging_product: "whatsapp",
              to: number,
              type: "image",
              image: {
                link: getImageUrlForTemplate()
              }
            };

            // Add caption if provided
            if (imageCaption.trim()) {
              imagePayload.image.caption = imageCaption.trim();
            }

            console.log('📸 Sending direct image message:', JSON.stringify(imagePayload, null, 2));

            try {
              const imageResponse = await axios.post(
                `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
                imagePayload,
                {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                  }
                }
              );
              console.log(`✅ Image sent successfully to ${number}:`, imageResponse.data);
              
              // If sending image only, return here
              if (imageOnly) {
                return { 
                  number, 
                  success: true, 
                  messageId: imageResponse.data.messages?.[0]?.id,
                  type: 'image'
                };
              }
              
              // If sending both image and template, continue to template below
              console.log('📨 Also sending template message...');
            } catch (error: any) {
              console.error(`❌ Image send failed for ${number}:`, error.response?.data);
              return { 
                number, 
                success: false, 
                error: error.response?.data?.error?.message || error.message,
                type: 'image'
              };
            }
          }

          // Skip template if only sending image
          if (imageOnly) {
            return { number, success: true, messageId: '', type: 'image' };
          }

          // Basic template payload
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

          // For media templates, add components structure
          if (hasMedia && templateComponents.length > 0 && !simpleMode) {
            // Build components based on actual template structure (only when NOT in simple mode)
            payload.template.components = [];
            const currentImageUrl = getImageUrlForTemplate();
            
            templateComponents.forEach((comp: any) => {
              if (comp.type === 'HEADER' && comp.format === 'IMAGE') {
                console.log('📸 Found IMAGE header component');
                console.log('📸 Component details:', comp);
                
                // Check if this is a predefined image template
                const hasPredefinedImage = comp.example?.header_handle?.[0];
                
                if (hasPredefinedImage) {
                  console.log('📸 Template has predefined image - NOT adding components');
                  // For predefined images, don't add any components
                  // The template already has the image defined
                } else {
                  console.log('📸 Template expects dynamic image - adding image parameter');
                  console.log('📸 Using image URL:', currentImageUrl);
                  
                  if (currentImageUrl) {
                    // For dynamic images, add the image parameter
                    payload.template.components.push({
                      type: "header",
                      parameters: [
                        {
                          type: "image",
                          image: {
                            link: currentImageUrl
                          }
                        }
                      ]
                    });
                  } else {
                    console.log('⚠️ No image URL provided for dynamic image template');
                  }
                }
              } else if (comp.type === 'HEADER' && comp.format === 'VIDEO') {
                const hasPredefinedVideo = comp.example?.header_handle?.[0];
                if (!hasPredefinedVideo) {
                  payload.template.components.push({
                    type: "header",
                    parameters: [
                      {
                        type: "video",
                        video: {
                          link: "" // You would provide the actual video URL here
                        }
                      }
                    ]
                  });
                }
              } else if (comp.type === 'HEADER' && comp.format === 'DOCUMENT') {
                const hasPredefinedDocument = comp.example?.header_handle?.[0];
                if (!hasPredefinedDocument) {
                  payload.template.components.push({
                    type: "header",
                    parameters: [
                      {
                        type: "document",
                        document: {
                          link: "" // You would provide the actual document URL here
                        }
                      }
                    ]
                  });
                }
              } else if (comp.type === 'BODY' && comp.text && comp.text.includes('{{')) {
                // Handle body text with variables
                console.log('📝 Found BODY with variables:', comp.text);
                // You would add body parameters here if needed
              }
            });
            
            // If no components were added, remove the components array entirely
            if (payload.template.components.length === 0) {
              delete payload.template.components;
              console.log('📸 No components needed - removed components array');
            }
          } else if (hasMedia && !simpleMode) {
            // Fallback for when we don't have template components - assume dynamic media
            console.log('📸 No template components available - assuming dynamic media');
            const currentImageUrl = getImageUrlForTemplate();
            
            if (currentImageUrl) {
              payload.template.components = [
                {
                  type: "header",
                  parameters: [
                    {
                      type: "image",
                      image: {
                        link: currentImageUrl
                      }
                    }
                  ]
                }
              ];
            } else {
              console.log('⚠️ No image URL provided for media template');
            }
          }

          // In simple mode, don't add any components
          if (simpleMode) {
            console.log('🔧 Simple mode: sending template without components');
          }

          console.log('Sending payload:', JSON.stringify(payload, null, 2));
          console.log('Template components used:', templateComponents);
          console.log('Has media checkbox:', hasMedia);

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
            console.log(`Success sending to ${number}:`, response.data);
            
            // Log message details for tracking
            if (response.data.messages && response.data.messages[0]) {
              const messageId = response.data.messages[0].id;
              console.log(`📨 Message ID: ${messageId} sent to ${number}`);
              toast({
                title: `Message Sent to ${number}`,
                description: `Message ID: ${messageId}`,
                status: 'success',
                duration: 5000,
                isClosable: true,
              });
            }
            
            return { number, success: true, messageId: response.data.messages?.[0]?.id };
          } catch (error: any) {
            console.error(`Error sending to ${number}:`, {
              status: error.response?.status,
              statusText: error.response?.statusText,
              data: error.response?.data,
              url: `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
              headers: error.response?.headers
            });
            
            // Log the full error details for debugging
            console.log('Full error object:', error.response?.data);
            
            const errorMessage = error.response?.data?.error?.message || 
                               error.response?.data?.error?.error_user_msg ||
                               error.response?.data?.message ||
                               error.message;
            return { 
              number, 
              success: false, 
              error: errorMessage,
              statusCode: error.response?.status,
              fullError: error.response?.data
            };
          }
        })
      );

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      const failedResults = results.filter(r => !r.success);
      
      // Store message IDs for status checking
      const messageIds = results.filter(r => r.success && r.messageId).map(r => r.messageId);
      setLastMessageIds(messageIds);

      // Log failed results for debugging
      if (failedResults.length > 0) {
        console.error('Failed messages:', failedResults);
        
        // Show specific error for 404s
        const has404 = failedResults.some(r => r.statusCode === 404);
        if (has404) {
          toast({
            title: 'API Configuration Error',
            description: 'Phone Number ID might be incorrect. Check your WhatsApp Business API settings.',
            status: 'error',
            duration: 10000,
            isClosable: true,
          });
        }
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

  const runDiagnostics = async () => {
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

    console.log('🔍 Starting WhatsApp API Diagnostics...');
    
    try {
      // Test 1: Check Phone Number ID
      console.log('📱 Testing Phone Number ID...');
      const phoneResponse = await axios.get(
        `https://graph.facebook.com/v22.0/${phoneNumberId}`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );
      console.log('✅ Phone Number ID is valid:', phoneResponse.data);

      // Test 2: Check Business Account
      console.log('🏢 Testing Business Account...');
      const businessResponse = await axios.get(
        `https://graph.facebook.com/v22.0/704635985705044`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );
      console.log('✅ Business Account is accessible:', businessResponse.data);

      // Test 3: Check Messaging Permissions
      console.log('🔐 Testing Messaging Permissions...');
      const permissionsResponse = await axios.get(
        `https://graph.facebook.com/v22.0/704635985705044/message_templates`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );
      console.log('✅ Can access message templates:', permissionsResponse.data);

      // Test 4: Check if Phone Number can send messages
      console.log('📤 Testing Message Sending Capability...');
      const testPayload = {
        messaging_product: "whatsapp",
        to: "+1234567890", // Dummy number for testing
        type: "template",
        template: {
          name: "hello_world",
          language: { code: "en_US" }
        }
      };

      try {
        await axios.post(
          `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
          testPayload,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('✅ Message endpoint is accessible');
      } catch (error: any) {
        console.log('❌ Message endpoint error:', error.response?.data);
        if (error.response?.status === 404) {
          console.log('🚨 404 Error: Phone Number ID cannot send messages');
        } else if (error.response?.status === 400) {
          console.log('⚠️ 400 Error: Endpoint works but payload/number is invalid (expected)');
        }
      }

      toast({
        title: 'Diagnostics Complete',
        description: 'Check console for detailed results',
        status: 'info',
        duration: 8000,
        isClosable: true,
      });

    } catch (error: any) {
      console.error('❌ Diagnostic failed:', error.response?.data);
      toast({
        title: 'Diagnostic Failed',
        description: `${error.response?.status}: ${error.response?.data?.error?.message || 'Unknown error'}`,
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
    }
  };

  const testHelloWorld = async () => {
    if (!accessToken || !phoneNumberId) {
      toast({
        title: 'Missing Information',
        description: 'Please enter Access Token and Phone Number ID',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    const testNumber = phoneNumbers.split('\n')[0]?.trim();
    if (!testNumber) {
      toast({
        title: 'No Phone Number',
        description: 'Please enter at least one phone number to test',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    try {
      const payload = {
        messaging_product: "whatsapp",
        to: testNumber,
        type: "template",
        template: {
          name: "hello_world",
          language: {
            code: "en_US"
          }
        }
      };

      console.log('🧪 Testing hello_world template:', payload);

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

      console.log('✅ Hello world test successful:', response.data);
      toast({
        title: 'Hello World Test Successful',
        description: `Message sent to ${testNumber}`,
        status: 'success',
        duration: 8000,
        isClosable: true,
      });

    } catch (error: any) {
      console.error('❌ Hello world test failed:', error.response?.data);
      toast({
        title: 'Hello World Test Failed',
        description: `${error.response?.status}: ${error.response?.data?.error?.message || 'Unknown error'}`,
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
    }
  };

  const checkMessageStatus = async () => {
    if (!accessToken || lastMessageIds.length === 0) {
      toast({
        title: 'No Messages to Check',
        description: 'Send some messages first, then check their status',
        status: 'warning',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    console.log('📊 Checking status for message IDs:', lastMessageIds);

    try {
      const statusChecks = await Promise.all(
        lastMessageIds.map(async (messageId) => {
          try {
            const response = await axios.get(
              `https://graph.facebook.com/v22.0/${messageId}`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                }
              }
            );
            console.log(`📨 Message ${messageId} status:`, response.data);
            return { messageId, status: response.data, success: true };
          } catch (error: any) {
            console.log(`❌ Failed to check message ${messageId}:`, error.response?.data);
            return { messageId, error: error.response?.data, success: false };
          }
        })
      );

      const successfulChecks = statusChecks.filter(c => c.success);
      console.log('📊 Message status summary:', statusChecks);

      toast({
        title: 'Message Status Check Complete',
        description: `Checked ${statusChecks.length} messages. See console for details.`,
        status: 'info',
        duration: 8000,
        isClosable: true,
      });

    } catch (error: any) {
      console.error('Failed to check message status:', error);
      toast({
        title: 'Status Check Failed',
        description: 'Failed to check message status',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const checkAccountVerification = async () => {
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

    console.log('🔍 Checking WhatsApp Business Account verification status...');

    try {
      // Check business account details
      const businessResponse = await axios.get(
        `https://graph.facebook.com/v22.0/704635985705044`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          params: { fields: 'id,name,currency,timezone_id' }
        }
      );
      console.log('🏢 Business Account Details:', businessResponse.data);

      // Check phone number details
      const phoneResponse = await axios.get(
        `https://graph.facebook.com/v22.0/${phoneNumberId}`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          params: { fields: 'id,display_phone_number,verified_name,code_verification_status,quality_rating,throughput' }
        }
      );
      console.log('📱 Phone Number Details:', phoneResponse.data);

      // Check app permissions
      try {
        const appResponse = await axios.get(
          `https://graph.facebook.com/v22.0/me/permissions`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          }
        );
        console.log('🔐 App Permissions:', appResponse.data);
      } catch (error) {
        console.log('⚠️ Could not check app permissions');
      }

      // Analyze results
      const phoneData = phoneResponse.data;
      const businessData = businessResponse.data;

      let issues = [];
      let recommendations = [];

      if (phoneData.code_verification_status !== 'VERIFIED') {
        issues.push(`Phone verification: ${phoneData.code_verification_status}`);
        recommendations.push('Complete phone number verification in WhatsApp Business Manager');
      }

      if (phoneData.quality_rating !== 'GREEN') {
        issues.push(`Quality rating: ${phoneData.quality_rating}`);
        recommendations.push('Improve message quality to get GREEN rating');
      }

      // Check throughput level
      if (phoneData.throughput && phoneData.throughput.level) {
        console.log(`📊 Throughput level: ${phoneData.throughput.level}`);
        if (phoneData.throughput.level === 'STANDARD') {
          console.log('ℹ️ Standard throughput - normal for new accounts');
        }
      }

      // Check if account is new/limited
      console.log('🔍 Account Analysis:');
      console.log('- Business Name:', businessData.name);
      console.log('- Phone Display:', phoneData.display_phone_number);
      console.log('- Verified Name:', phoneData.verified_name);
      console.log('- Code Verification:', phoneData.code_verification_status);
      console.log('- Quality Rating:', phoneData.quality_rating);

      if (issues.length > 0) {
        console.log('❌ Issues found:', issues);
        console.log('💡 Recommendations:', recommendations);
        toast({
          title: 'Account Issues Found',
          description: `Found ${issues.length} issues. Check console for details.`,
          status: 'warning',
          duration: 10000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Account Verification OK',
          description: 'No obvious verification issues found',
          status: 'success',
          duration: 8000,
          isClosable: true,
        });
      }

    } catch (error: any) {
      console.error('❌ Failed to check account verification:', error.response?.data);
      toast({
        title: 'Verification Check Failed',
        description: 'Could not check account verification status',
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
    }
  };

  const testBasicDelivery = async () => {
    if (!accessToken || !phoneNumberId) {
      toast({
        title: 'Missing Information',
        description: 'Please enter Access Token and Phone Number ID',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    // Use your own number for testing
    const testNumber = prompt('Enter YOUR WhatsApp number (with country code, e.g., +201234567890) to test delivery:');
    if (!testNumber) return;

    try {
      console.log('🧪 Testing basic delivery to your own number...');
      
      const payload = {
        messaging_product: "whatsapp",
        to: testNumber,
        type: "template",
        template: {
          name: "hello_world",
          language: {
            code: "en_US"
          }
        }
      };

      console.log('📤 Sending test message:', payload);

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

      console.log('✅ Test message response:', response.data);
      
      if (response.data.messages && response.data.messages[0]) {
        const messageId = response.data.messages[0].id;
        toast({
          title: 'Test Message Sent',
          description: `Check your WhatsApp for hello_world message. Message ID: ${messageId}`,
          status: 'success',
          duration: 15000,
          isClosable: true,
        });
      }

    } catch (error: any) {
      console.error('❌ Test message failed:', error.response?.data);
      toast({
        title: 'Test Message Failed',
        description: `${error.response?.status}: ${error.response?.data?.error?.message || 'Unknown error'}`,
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
    }
  };

  const testImageTemplate = async () => {
    if (!accessToken || !phoneNumberId) {
      toast({
        title: 'Missing Information',
        description: 'Please enter Access Token and Phone Number ID',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    const testNumber = phoneNumbers.split('\n')[0]?.trim();
    if (!testNumber) {
      toast({
        title: 'No Phone Number',
        description: 'Please enter at least one phone number to test',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    try {
      console.log('🧪 Testing image template with predefined image...');
      
      // First, let's check the template structure
      if (templateComponents.length === 0) {
        toast({
          title: 'No Template Components',
          description: 'Please run "Check Template Structure" first to analyze your template',
          status: 'warning',
          duration: 8000,
          isClosable: true,
        });
        return;
      }

      const payload = {
        messaging_product: "whatsapp",
        to: testNumber,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: templateLanguage
          }
        }
      };

      console.log('📤 Sending image template (NO components):', payload);
      console.log('📸 Template components available:', templateComponents);

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

      console.log('✅ Image template test successful:', response.data);
      
      if (response.data.messages && response.data.messages[0]) {
        const messageId = response.data.messages[0].id;
        toast({
          title: 'Image Template Test Successful',
          description: `Message sent to ${testNumber}. Message ID: ${messageId}`,
          status: 'success',
          duration: 8000,
          isClosable: true,
        });
      }

    } catch (error: any) {
      console.error('❌ Image template test failed:', error.response?.data);
      
      // Detailed error analysis
      if (error.response?.data?.error) {
        const errorData = error.response.data.error;
        console.log('🔍 Error details:', errorData);
        
        if (errorData.code === 132012) {
          console.log('💡 Error 132012: Parameter format mismatch');
          console.log('💡 This usually means the template expects different parameters');
        }
      }
      
      toast({
        title: 'Image Template Test Failed',
        description: `${error.response?.status}: ${error.response?.data?.error?.message || 'Unknown error'}`,
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
    }
  };

  const testDirectImage = async () => {
    if (!accessToken || !phoneNumberId) {
      toast({
        title: 'Missing Information',
        description: 'Please enter Access Token and Phone Number ID',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    const testNumber = phoneNumbers.split('\n')[0]?.trim();
    if (!testNumber) {
      toast({
        title: 'No Phone Number',
        description: 'Please enter at least one phone number to test',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    const currentImageUrl = getImageUrlForTemplate();
    if (!currentImageUrl) {
      toast({
        title: 'No Image URL',
        description: 'Please upload an image or provide an image URL first',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    try {
      console.log('🧪 Testing direct image message...');

      const payload = {
        messaging_product: "whatsapp",
        to: testNumber,
        type: "image",
        image: {
          link: currentImageUrl,
          caption: imageCaption || "Test image sent via WhatsApp Business API"
        }
      };

      console.log('📤 Sending direct image message:', JSON.stringify(payload, null, 2));

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

      console.log('✅ Direct image test successful:', response.data);
      
      if (response.data.messages && response.data.messages[0]) {
        const messageId = response.data.messages[0].id;
        toast({
          title: 'Direct Image Test Successful',
          description: `Image sent to ${testNumber}. Message ID: ${messageId}`,
          status: 'success',
          duration: 8000,
          isClosable: true,
        });
      }

    } catch (error: any) {
      console.error('❌ Direct image test failed:', error.response?.data);
      
      toast({
        title: 'Direct Image Test Failed',
        description: `${error.response?.status}: ${error.response?.data?.error?.message || 'Unknown error'}`,
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
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
                <FormLabel>Phone Number ID</FormLabel>
                <Input
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  placeholder="Enter your Phone Number ID"
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Find this in your WhatsApp Business Account → API Setup → Phone Numbers
                </Text>
              </FormControl>

              <Button
                onClick={testConnection}
                colorScheme="green"
                variant="outline"
                width="full"
                size="sm"
              >
                Test Connection
              </Button>

              <Button
                onClick={findPhoneNumbers}
                colorScheme="blue"
                variant="outline"
                width="full"
                size="sm"
              >
                Find My Phone Numbers
              </Button>

              <Button
                onClick={checkTemplate}
                colorScheme="purple"
                variant="outline"
                width="full"
                size="sm"
              >
                Check Template Structure
              </Button>

              <Button
                onClick={listAllTemplates}
                colorScheme="orange"
                variant="outline"
                width="full"
                size="sm"
              >
                List All Available Templates
              </Button>

              <Button
                onClick={runDiagnostics}
                colorScheme="red"
                variant="outline"
                width="full"
                size="sm"
              >
                Run Comprehensive Diagnostics
              </Button>

              <Button
                onClick={testHelloWorld}
                colorScheme="teal"
                variant="outline"
                width="full"
                size="sm"
              >
                Test Hello World Template
              </Button>

              <Button
                onClick={checkMessageStatus}
                colorScheme="yellow"
                variant="outline"
                width="full"
                size="sm"
                isDisabled={lastMessageIds.length === 0}
              >
                Check Last Message Status
              </Button>

              <Button
                onClick={checkAccountVerification}
                colorScheme="purple"
                variant="outline"
                width="full"
                size="sm"
              >
                Check Account Verification
              </Button>

              <Button
                onClick={testBasicDelivery}
                colorScheme="cyan"
                variant="outline"
                width="full"
                size="sm"
              >
                Test Basic Delivery
              </Button>

              <Button
                onClick={testImageTemplate}
                colorScheme="pink"
                variant="outline"
                width="full"
                size="sm"
              >
                Test Image Template with Predefined Image
              </Button>

              <Button
                onClick={testDirectImage}
                colorScheme="green"
                variant="outline"
                width="full"
                size="sm"
              >
                🚀 Test Direct Image Message
              </Button>

              <Button
                onClick={() => setSimpleMode(!simpleMode)}
                colorScheme={simpleMode ? "red" : "green"}
                variant="outline"
                width="full"
                size="sm"
              >
                {simpleMode ? "Disable Simple Mode" : "Enable Simple Mode"}
              </Button>

              <FormControl isRequired>
                <FormLabel>Template Name</FormLabel>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Enter template name"
                />
                <FormLabel mt={3}>Template Language</FormLabel>
                <Select
                  value={templateLanguage}
                  onChange={(e) => setTemplateLanguage(e.target.value)}
                >
                  <option value="en_US">English (US)</option>
                  <option value="en">English</option>
                  <option value="ar">Arabic</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="pt_BR">Portuguese (Brazil)</option>
                  <option value="ru">Russian</option>
                  <option value="zh_CN">Chinese (Simplified)</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                </Select>
              </FormControl>

              <VStack align="stretch" spacing={2}>
                <Checkbox
                  isChecked={hasMedia}
                  onChange={(e) => setHasMedia(e.target.checked)}
                >
                  Template contains media (image, video, document)
                </Checkbox>
                <Checkbox
                  isChecked={simpleMode}
                  onChange={(e) => setSimpleMode(e.target.checked)}
                >
                  🔧 Simple mode (send without components - for testing)
                </Checkbox>
                <Text fontSize="xs" color="gray.500">
                  Check this if your template has a header with image, video, or document
                </Text>
              </VStack>

              {hasMedia && (
                <Box border="1px solid" borderColor="gray.200" p={4} borderRadius="md">
                  <VStack align="stretch" spacing={4}>
                    <Heading size="sm" color="blue.600">📸 Image Configuration</Heading>
                    
                    <Alert status="info" size="sm">
                      <AlertIcon />
                      <Box>
                        <AlertTitle>Image Requirements:</AlertTitle>
                        <AlertDescription>
                          Images must be publicly accessible URLs. Max 5MB for WhatsApp.
                        </AlertDescription>
                      </Box>
                    </Alert>

                    <FormControl>
                      <FormLabel>Image URL (Direct Link)</FormLabel>
                      <Input
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://example.com/image.jpg"
                        type="url"
                      />
                      <Text fontSize="xs" color="gray.500" mt={1}>
                        Paste a direct link to your image, or upload an image below
                      </Text>
                    </FormControl>

                    <Divider />

                    <FormControl>
                      <FormLabel>Or Upload Image</FormLabel>
                      <VStack align="stretch" spacing={3}>
                        <HStack>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            ref={imageInputRef}
                            display="none"
                          />
                          <Button
                            onClick={() => imageInputRef.current?.click()}
                            colorScheme="blue"
                            width="full"
                            isDisabled={!!uploadedImageUrl}
                          >
                            📷 Select Image File
                          </Button>
                          {imageFile && (
                                                         <Button
                               onClick={uploadImageWithFallback}
                               colorScheme="green"
                               isDisabled={!!uploadedImageUrl}
                             >
                               ⬆️ Upload Image
                             </Button>
                          )}
                          {(imageFile || uploadedImageUrl || imageUrl) && (
                            <Button
                              onClick={clearImage}
                              colorScheme="red"
                              variant="outline"
                            >
                              🗑️ Clear
                            </Button>
                          )}
                        </HStack>

                                                    {imageFile && !uploadedImageUrl && (
                              <Alert status="warning" size="sm">
                                <AlertIcon />
                                <AlertDescription>
                                  Image selected but not uploaded yet. Click "Upload Image" to make it accessible for WhatsApp.
                                </AlertDescription>
                              </Alert>
                            )}

                            {/* Manual upload fallback */}
                            <Box border="1px solid" borderColor="orange.200" p={3} borderRadius="md" bg="orange.50">
                              <VStack align="stretch" spacing={2}>
                                <Heading size="xs" color="orange.600">🔧 Manual Upload (Fallback)</Heading>
                                <Text fontSize="sm" color="orange.700">
                                  If automatic upload fails, you can upload your image to any hosting service and paste the URL:
                                </Text>
                                <VStack align="stretch" spacing={1}>
                                  <Text fontSize="xs" color="orange.600">
                                    • Upload to: <Link href="https://imgur.com/" isExternal color="blue.500">Imgur</Link>, <Link href="https://imgbb.com/" isExternal color="blue.500">ImgBB</Link>, <Link href="https://postimages.org/" isExternal color="blue.500">PostImages</Link>, or <Link href="https://imageupload.io/" isExternal color="blue.500">ImageUpload</Link>
                                  </Text>
                                  <Text fontSize="xs" color="orange.600">
                                    • Copy the direct image link (not the page link)
                                  </Text>
                                  <Text fontSize="xs" color="orange.600">
                                    • Paste the URL in the "Image URL" field above
                                  </Text>
                                </VStack>
                              </VStack>
                            </Box>

                                                  {uploadedImageUrl && (
                            <Alert status="success" size="sm">
                              <AlertIcon />
                              <AlertDescription>
                                ✅ Image uploaded successfully! Ready to send via WhatsApp.
                              </AlertDescription>
                            </Alert>
                          )}

                        {imagePreview && (
                          <Box>
                            <Text fontSize="sm" fontWeight="semibold" mb={2}>Preview:</Text>
                            <Image
                              src={imagePreview}
                              alt="Image preview"
                              maxH="200px"
                              objectFit="contain"
                              border="1px solid"
                              borderColor="gray.200"
                              borderRadius="md"
                            />
                          </Box>
                        )}

                        {uploadedImageUrl && (
                          <Box>
                            <Text fontSize="sm" fontWeight="semibold" mb={1}>Uploaded Image URL:</Text>
                            <Link
                              href={uploadedImageUrl}
                              isExternal
                              color="blue.500"
                              fontSize="xs"
                              wordBreak="break-all"
                            >
                              {uploadedImageUrl}
                            </Link>
                          </Box>
                        )}
                      </VStack>
                    </FormControl>

                    {getImageUrlForTemplate() && (
                      <Alert status="info" size="sm">
                        <AlertIcon />
                        <AlertDescription>
                          ✅ Image URL ready: {getImageUrlForTemplate().substring(0, 50)}...
                        </AlertDescription>
                      </Alert>
                    )}
                  </VStack>
                </Box>
              )}

              <Box border="2px solid" borderColor="green.200" p={4} borderRadius="md" bg="green.50">
                <VStack align="stretch" spacing={4}>
                  <Heading size="sm" color="green.600">🚀 Direct Image Messages (Recommended)</Heading>
                  
                  <Alert status="success" size="sm">
                    <AlertIcon />
                    <Box>
                      <AlertTitle>Bypass Template Issues!</AlertTitle>
                      <AlertDescription>
                        Send images directly as regular WhatsApp messages - much more reliable than templates!
                      </AlertDescription>
                    </Box>
                  </Alert>

                  <VStack align="stretch" spacing={3}>
                    <Checkbox
                      isChecked={sendDirectImage}
                      onChange={(e) => setSendDirectImage(e.target.checked)}
                      colorScheme="green"
                    >
                      📸 Send images as direct messages (not templates)
                    </Checkbox>

                    {sendDirectImage && (
                      <VStack align="stretch" spacing={3} pl={6}>
                        <FormControl>
                          <FormLabel>Image Caption (Optional)</FormLabel>
                          <Textarea
                            value={imageCaption}
                            onChange={(e) => setImageCaption(e.target.value)}
                            placeholder="Add a caption for your image..."
                            rows={2}
                            maxLength={1024}
                          />
                          <Text fontSize="xs" color="gray.500">
                            {imageCaption.length}/1024 characters
                          </Text>
                        </FormControl>

                        <Checkbox
                          isChecked={imageOnly}
                          onChange={(e) => setImageOnly(e.target.checked)}
                          colorScheme="green"
                        >
                          📷 Send image only (skip template message)
                        </Checkbox>

                        {!imageOnly && (
                          <Alert status="info" size="sm">
                            <AlertIcon />
                            <AlertDescription>
                              Will send both image message AND template message to each recipient
                            </AlertDescription>
                          </Alert>
                        )}

                        {imageOnly && (
                          <Alert status="warning" size="sm">
                            <AlertIcon />
                            <AlertDescription>
                              Will send ONLY the image message (no template needed)
                            </AlertDescription>
                          </Alert>
                        )}
                      </VStack>
                    )}
                  </VStack>

                  {/* Image upload section for direct messages */}
                  {sendDirectImage && (
                    <Box border="1px solid" borderColor="green.200" p={4} borderRadius="md" bg="white">
                      <VStack align="stretch" spacing={4}>
                        <Heading size="xs" color="green.600">📸 Image for Direct Message</Heading>
                        
                        <FormControl>
                          <FormLabel>Image URL (Direct Link)</FormLabel>
                          <Input
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            placeholder="https://example.com/image.jpg"
                            type="url"
                          />
                          <Text fontSize="xs" color="gray.500" mt={1}>
                            Paste a direct link to your image, or upload an image below
                          </Text>
                        </FormControl>

                        <Divider />

                        <FormControl>
                          <FormLabel>Or Upload Image</FormLabel>
                          <VStack align="stretch" spacing={3}>
                            <HStack>
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                ref={imageInputRef}
                                display="none"
                              />
                              <Button
                                onClick={() => imageInputRef.current?.click()}
                                colorScheme="green"
                                width="full"
                                isDisabled={!!uploadedImageUrl}
                              >
                                📷 Select Image File
                              </Button>
                                                         {imageFile && (
                             <Button
                               onClick={uploadImageWithFallback}
                               colorScheme="blue"
                               isDisabled={!!uploadedImageUrl}
                             >
                               ⬆️ Upload Image
                             </Button>
                           )}
                              {(imageFile || uploadedImageUrl || imageUrl) && (
                                <Button
                                  onClick={clearImage}
                                  colorScheme="red"
                                  variant="outline"
                                >
                                  🗑️ Clear
                                </Button>
                              )}
                            </HStack>

                            {imageFile && !uploadedImageUrl && (
                              <Alert status="warning" size="sm">
                                <AlertIcon />
                                <AlertDescription>
                                  Image selected but not uploaded yet. Click "Upload Image" to make it accessible for WhatsApp.
                                </AlertDescription>
                              </Alert>
                            )}

                            {/* Manual upload fallback */}
                            <Box border="1px solid" borderColor="orange.200" p={3} borderRadius="md" bg="orange.50">
                              <VStack align="stretch" spacing={2}>
                                <Heading size="xs" color="orange.600">🔧 Manual Upload (Fallback)</Heading>
                                <Text fontSize="sm" color="orange.700">
                                  If automatic upload fails, you can upload your image to any hosting service and paste the URL:
                                </Text>
                                <VStack align="stretch" spacing={1}>
                                  <Text fontSize="xs" color="orange.600">
                                    • Upload to: <Link href="https://imgur.com/" isExternal color="blue.500">Imgur</Link>, <Link href="https://imgbb.com/" isExternal color="blue.500">ImgBB</Link>, <Link href="https://postimages.org/" isExternal color="blue.500">PostImages</Link>, or <Link href="https://imageupload.io/" isExternal color="blue.500">ImageUpload</Link>
                                  </Text>
                                  <Text fontSize="xs" color="orange.600">
                                    • Copy the direct image link (not the page link)
                                  </Text>
                                  <Text fontSize="xs" color="orange.600">
                                    • Paste the URL in the "Image URL" field above
                                  </Text>
                                </VStack>
                              </VStack>
                            </Box>

                            {uploadedImageUrl && (
                              <Alert status="success" size="sm">
                                <AlertIcon />
                                <AlertDescription>
                                  ✅ Image uploaded successfully! Ready to send via WhatsApp.
                                </AlertDescription>
                              </Alert>
                            )}

                            {imagePreview && (
                              <Box>
                                <Text fontSize="sm" fontWeight="semibold" mb={2}>Preview:</Text>
                                <Image
                                  src={imagePreview}
                                  alt="Image preview"
                                  maxH="200px"
                                  objectFit="contain"
                                  border="1px solid"
                                  borderColor="gray.200"
                                  borderRadius="md"
                                />
                              </Box>
                            )}

                            {uploadedImageUrl && (
                              <Box>
                                <Text fontSize="sm" fontWeight="semibold" mb={1}>Uploaded Image URL:</Text>
                                <Link
                                  href={uploadedImageUrl}
                                  isExternal
                                  color="blue.500"
                                  fontSize="xs"
                                  wordBreak="break-all"
                                >
                                  {uploadedImageUrl}
                                </Link>
                              </Box>
                            )}
                          </VStack>
                        </FormControl>

                        {getImageUrlForTemplate() && (
                          <Alert status="success" size="sm">
                            <AlertIcon />
                            <AlertDescription>
                              ✅ Image URL ready: {getImageUrlForTemplate().substring(0, 50)}...
                            </AlertDescription>
                          </Alert>
                        )}
                      </VStack>
                    </Box>
                  )}
                </VStack>
              </Box>

              <FormControl>
                <FormLabel>Phone Numbers</FormLabel>
                <VStack align="stretch" spacing={2}>
                  <HStack>
                    <Input
                      id="file-upload-input"
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
                    id="phone-numbers-textarea"
                    value={phoneNumbers}
                    onChange={(e) => setPhoneNumbers(e.target.value)}
                    placeholder="Enter phone numbers (one per line)&#10;Format: +1234567890"
                    rows={5}
                    isRequired
                  />
                </VStack>
              </FormControl>

              <Button
                type="submit"
                colorScheme="blue"
                width="full"
                isLoading={isLoading}
                loadingText="Sending..."
                size="lg"
              >
                {sendDirectImage && imageOnly ? 
                  "📸 Send Images Only" : 
                  sendDirectImage ? 
                    "🚀 Send Images + Templates" : 
                    "📨 Send Template Messages"
                }
              </Button>
            </VStack>
          </Box>
        </VStack>
      </Container>
    </ChakraProvider>
  );
}

export default App; 