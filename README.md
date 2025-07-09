# 100x Email - AI-Powered Email Assistant

> Control your email 100X more effectively with intelligent AI assistance

100x Email is a sophisticated AI-powered email management application that revolutionizes how you interact with your inbox. Built with Next.js and powered by advanced AI models, it provides intelligent email analysis, automated responses, and seamless Gmail integration.

![App Screenshot](email-ai/public/app-screenshot.png)

## ✨ Features

### 🤖 AI-Powered Email Assistant
- **Intelligent Chat Interface**: Ask questions about your emails in natural language
- **Smart Email Analysis**: AI automatically identifies relevant emails for any query
- **Context-Aware Responses**: Get precise answers with email references
- **Email Summarization**: Generate TLDR summaries for long emails
- **Bulk Email Analysis**: Analyze multiple emails simultaneously

### 📧 Advanced Email Management
- **Compose & Send**: Rich text editor with HTML support
- **Smart Reply**: AI-generated reply suggestions
- **Draft Management**: Save and manage email drafts
- **Thread Support**: Full conversation threading
- **Attachment Handling**: Support for email attachments
- **Star & Flag**: Organize important emails

### 🔍 Powerful Search & Discovery
- **Semantic Search**: Find emails by meaning, not just keywords
- **Date-Aware Queries**: Support for "last week", "yesterday", etc.
- **Multi-criteria Search**: Combine multiple search parameters
- **Email Content Analysis**: Deep analysis of email content

### 🎨 Modern User Experience
- **Dark/Light Theme**: Beautiful, responsive design
- **Real-time Updates**: Live email synchronization
- **Resizable Panels**: Customizable layout
- **Mobile Responsive**: Works perfectly on all devices

### 🔐 Security & Privacy
- **Google OAuth Integration**: Secure authentication
- **Rate Limiting**: Protected API endpoints
- **Encrypted Tokens**: Secure token management
- **Privacy-First**: Your emails stay with you

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm/yarn/pnpm
- **PostgreSQL Database** (we recommend [Neon](https://neon.tech))
- **Google Cloud Project** with Gmail API enabled
- **Groq API Key** for AI features

### 1. Clone & Install

```bash
git clone https://github.com/your-username/100x.git
cd 100x/email-ai
npm install
```

### 2. Environment Configuration

Create `.env.local` in the `email-ai` directory:

```bash
# Database
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/google/callback"

# AI Features
GROQ_API_KEY="your-groq-api-key"

# App Configuration
NEXTAUTH_SECRET="your-nextauth-secret"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"

# encryption key
ENCRYPTION_KEY="your-encryption-key"
```

### 3. Database Setup

Follow the detailed [Neon Setup Guide](NEON_SETUP.md) or set up your PostgreSQL database:

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# (Optional) View your database
npx prisma studio
```

### 4. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable the Gmail API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/google/callback` (development)
   - `https://yourdomain.com/api/auth/google/callback` (production)

### 5. Groq API Setup

1. Sign up at [Groq](https://groq.com)
2. Generate an API key
3. Add to your `.env.local` file

### 6. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your application.

## 📁 Project Structure

```
email-ai/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # Authentication endpoints
│   │   │   ├── chat/          # AI chat functionality
│   │   │   ├── emails/        # Email management APIs
│   │   │   └── ...
│   │   ├── dashboard/         # Main dashboard pages
│   │   ├── login/             # Authentication pages
│   │   └── ...
│   ├── components/            # Reusable UI components
│   │   ├── ui/               # Base UI components
│   │   └── ...
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Utility libraries
│   └── types/                # TypeScript type definitions
├── prisma/                   # Database schema
├── public/                   # Static assets
└── ...
```

## 🛠️ Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | ✅ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | ✅ |
| `GROQ_API_KEY` | Groq AI API key | ✅ |
| `ENCRYPTION_KEY` | encryption key | ✅ |
| `NEXTAUTH_SECRET` | NextAuth.js secret | ✅ |
| `NEXT_PUBLIC_BASE_URL` | Application base URL | ✅ |

### AI Models

The application uses Groq's high-performance AI models:
- **Primary**: `gemma2-9b-it` for email analysis and chat
- **Secondary**: `llama-3.1-8b-instant` for summarization

## 🚢 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Add all environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Other Platforms

The application can be deployed on any Node.js hosting platform:

```bash
# Build the application
npm run build

# Start production server
npm start
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Code Style

- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting
- Tailwind CSS for styling

## 📄 API Reference

### Chat API

```typescript
POST /api/chat
{
  "messages": [
    {
      "role": "user",
      "content": "Find emails from John about the project"
    }
  ]
}
```

### Email Operations

```typescript
// Send email
POST /api/emails/send
{
  "to": "recipient@example.com",
  "subject": "Subject",
  "content": "Email content"
}

// Get email summary
POST /api/emails/tldr
{
  "emailContent": "Long email content...",
  "subject": "Email subject"
}
```

## 🔧 Troubleshooting

### Common Issues

1. **Database Connection**: Ensure your PostgreSQL database is running and the connection string is correct
2. **Google OAuth**: Verify your OAuth credentials and redirect URIs
3. **API Rate Limits**: The app includes rate limiting to prevent abuse
4. **AI Model Errors**: Check your Groq API key and quota

### Debug Mode

Enable debug logging by setting:

```bash
DEBUG=true
```

## 📞 Support

- **Documentation**: Check our [Wiki](https://github.com/your-username/100x/wiki)
- **Issues**: [GitHub Issues](https://github.com/your-username/100x/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/100x/discussions)

## 📊 Performance

- **Response Time**: < 200ms for most operations
- **AI Processing**: < 2 seconds for email analysis
- **Email Sync**: Real-time Gmail synchronization
- **Concurrent Users**: Designed for high scalability

## 🔒 Security

- OAuth 2.0 authentication with Google
- JWT-based session management
- Rate limiting on all endpoints
- Input sanitization and validation
- Secure cookie handling

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org) for the amazing framework
- [Groq](https://groq.com) for lightning-fast AI inference
- [Google](https://developers.google.com/gmail) for Gmail API
- [Neon](https://neon.tech) for serverless PostgreSQL
- [Vercel](https://vercel.com) for deployment platform

---

**Made with ❤️ for the future of email management**
