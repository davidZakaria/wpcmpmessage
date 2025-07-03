# WhatsApp Sender

A modern React application for sending bulk WhatsApp messages using the WhatsApp Business API.

## Features

- 📱 **Bulk Messaging**: Send messages to multiple contacts at once
- 📁 **File Upload**: Import phone numbers from CSV/TXT files
- 🎯 **Template Support**: Use WhatsApp approved message templates
- 🔄 **Real-time Feedback**: Live status updates and error reporting
- 🎨 **Modern UI**: Beautiful interface built with Chakra UI
- 📊 **Detailed Logging**: Comprehensive error tracking and debugging

## Screenshots

![WhatsApp Sender Interface](screenshot.png)

## Prerequisites

Before running this application, make sure you have:

1. **Node.js** (v16 or higher)
2. **WhatsApp Business Account** with API access
3. **Access Token** from Meta Business
4. **Phone Number ID** from your WhatsApp Business account

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/whatsapp-sender.git
cd whatsapp-sender
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:3000`

## Usage

1. **Enter Access Token**: Input your WhatsApp Business API access token
2. **Template Name**: Enter the name of your approved WhatsApp template
3. **Phone Numbers**: Either:
   - Upload a CSV/TXT file with phone numbers
   - Manually enter numbers (one per line)
4. **Send Messages**: Click "Send Messages" to start the bulk sending process

## Phone Number Format

Make sure phone numbers are in international format:
- ✅ Correct: `+1234567890`
- ❌ Wrong: `1234567890`

## Configuration

### WhatsApp Business API Setup

1. Create a WhatsApp Business Account
2. Set up a WhatsApp Business API
3. Get your Phone Number ID and Access Token
4. Create and approve message templates

### Environment Variables (Optional)

Create a `.env` file in the root directory:
```env
VITE_WHATSAPP_PHONE_ID=your_phone_number_id
VITE_WHATSAPP_ACCESS_TOKEN=your_access_token
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Technologies Used

- **React 18** - Frontend framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Chakra UI** - Component library
- **Axios** - HTTP client
- **WhatsApp Business API** - Messaging service

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions:

1. Check the browser console for detailed error messages
2. Verify your WhatsApp Business API credentials
3. Ensure phone numbers are in the correct format
4. Open an issue on GitHub

## Roadmap

- [ ] Token persistence
- [ ] Message scheduling
- [ ] Analytics dashboard
- [ ] Multi-media support
- [ ] Campaign management
- [ ] Database integration

## Disclaimer

This tool is for legitimate business communication only. Make sure you comply with WhatsApp's terms of service and local regulations regarding bulk messaging. 