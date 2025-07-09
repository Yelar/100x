# Gmail Webhook Setup Guide

This guide will help you set up Gmail push notifications using Google Pub/Sub to receive real-time notifications when new emails arrive.

## 🏗️ Architecture Overview

```
Gmail → Google Pub/Sub → Your Webhook → Console Logs
```

## 📋 Prerequisites

1. **Google Cloud Project** with billing enabled
2. **Gmail API** enabled
3. **Pub/Sub API** enabled
4. **Service Account** with appropriate permissions
5. **OAuth 2.0 credentials** for Gmail access

## 🔧 Setup Steps

### 1. Google Cloud Project Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Gmail API
   - Pub/Sub API

### 2. Create Pub/Sub Topic

```bash
# Create a topic for Gmail notifications
gcloud pubsub topics create gmail-notifications

# Verify the topic was created
gcloud pubsub topics list
```

### 3. Create Pub/Sub Subscription

```bash
# Create a push subscription that points to your webhook
gcloud pubsub subscriptions create gmail-webhook-subscription \
    --topic=gmail-notifications \
    --push-endpoint=https://your-domain.com/api/webhook/gmail \
    --ack-deadline=60
```

### 4. Set Up Authentication

1. Go to **APIs & Services > Credentials**
2. Create OAuth 2.0 Client ID for web application
3. Add your domain to authorized redirect URIs
4. Download the client secrets JSON file

### 5. Configure Environment Variables

Add these to your `.env.local` file:

```env
GOOGLE_CLIENT_SECRETS={"web":{"client_id":"your-client-id","client_secret":"your-client-secret","redirect_uris":["https://your-domain.com/api/auth/google/callback"]}}
```

### 6. Configure ngrok (for local testing)

1. **Sign up for ngrok** (free at https://ngrok.com/)
2. **Get your auth token** from the ngrok dashboard
3. **Update ngrok configuration**:
   ```bash
   # Edit ngrok.yml and replace with your auth token
   sed -i 's/your-ngrok-auth-token-here/YOUR_ACTUAL_AUTH_TOKEN/' ngrok.yml
   ```

4. **Optional: Set custom subdomain** (requires paid plan):
   ```yaml
   # In ngrok.yml, replace 'your-custom-subdomain' with your preferred subdomain
   subdomain: your-custom-subdomain
   ```

## 🚀 Using the Webhook

### Endpoints Available

1. **Webhook Receiver**: `POST /api/webhook/gmail`
   - Receives Pub/Sub notifications from Gmail
   - Currently logs notifications to console

2. **Setup Helper**: `POST /api/webhook/setup`
   - Helps set up Gmail push notifications
   - Requires access token and topic name

### Setting Up Push Notifications

```javascript
// Example: Set up push notifications
const response = await fetch('/api/webhook/setup', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    accessToken: 'your-gmail-access-token',
    topicName: 'projects/your-project/topics/gmail-notifications',
    labelIds: ['INBOX'] // optional, defaults to INBOX
  })
});

const result = await response.json();
console.log('Setup result:', result);
```

### Testing the Webhook

#### Local Testing with ngrok

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server with ngrok tunnel**:
   ```bash
   npm run dev:tunnel
   ```

3. **Get your ngrok URL**:
   - Visit http://localhost:4040 to see the ngrok dashboard
   - Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

4. **Test the webhook locally**:
   ```bash
   # Test with localhost
   npm run webhook:test
   
   # Test with ngrok URL
   npm run webhook:test:ngrok
   ```

5. **Manual testing**:
   ```bash
   # Test the endpoint directly
   curl -X GET https://your-ngrok-url.ngrok.io/api/webhook/gmail
   
   # Test with custom webhook URL
   WEBHOOK_URL=https://your-ngrok-url.ngrok.io/api/webhook/gmail npm run webhook:test
   ```

#### Production Testing

1. **Test the endpoint directly**:
   ```bash
   curl -X GET https://your-domain.com/api/webhook/gmail
   ```

2. **Send a test Pub/Sub message**:
   ```bash
   gcloud pubsub topics publish gmail-notifications \
     --message='{"emailAddress":"test@example.com","historyId":"12345"}'
   ```

## 📊 Monitoring

### Console Logs

The webhook will log the following information:

- 🔔 New email notifications received
- 📧 Email address and history ID
- 📋 Full notification data
- ✅ Processing status

### Example Log Output

```
🌐 Webhook endpoint called
🔔 New email notification received!
📧 Email ID: user@gmail.com
📅 History ID: 12345
📋 Full notification data: {
  "emailAddress": "user@gmail.com",
  "historyId": "12345",
  "expiration": "2024-01-01T00:00:00Z"
}
✅ Email notification processed successfully
```

## 🔄 Next Steps

### 1. Enhanced Email Processing

Currently, the webhook only logs notifications. To get actual email content:

```javascript
// In the webhook, you can fetch email details using the history ID
const webhookManager = createGmailWebhookManager(accessToken);
const history = await webhookManager.getHistory(historyId);
```

### 2. Database Integration

Store email notifications in your database:

```javascript
// Example: Save to database
await prisma.emailNotification.create({
  data: {
    emailAddress: emailData.emailAddress,
    historyId: emailData.historyId,
    processed: false
  }
});
```

### 3. Real-time UI Updates

Send notifications to connected clients:

```javascript
// Example: WebSocket notification
io.emit('new-email', {
  emailAddress: emailData.emailAddress,
  historyId: emailData.historyId
});
```

## 🛠️ Troubleshooting

### Common Issues

1. **403 Forbidden**: Check OAuth scopes and permissions
2. **404 Not Found**: Verify webhook URL is accessible
3. **401 Unauthorized**: Check access token validity
4. **Pub/Sub delivery failures**: Check subscription configuration

### Debug Commands

```bash
# Check Pub/Sub subscription status
gcloud pubsub subscriptions describe gmail-webhook-subscription

# View recent messages
gcloud pubsub subscriptions pull gmail-webhook-subscription --auto-ack

# Check Gmail API quotas
gcloud auth list
```

## 📚 Additional Resources

- [Gmail API Push Notifications](https://developers.google.com/gmail/api/guides/push)
- [Google Pub/Sub Documentation](https://cloud.google.com/pubsub/docs)
- [Gmail API History](https://developers.google.com/gmail/api/reference/rest/v1/users.history/list)

## 🔐 Security Considerations

1. **HTTPS Required**: Webhook endpoints must use HTTPS
2. **Authentication**: Verify Pub/Sub message authenticity
3. **Rate Limiting**: Implement rate limiting for webhook endpoints
4. **Access Control**: Restrict webhook access to authorized sources

## 📝 Notes

- Gmail push notifications expire after 7 days and need to be renewed
- The webhook currently only logs notifications (as requested)
- Future enhancements can include email content fetching and processing
- Consider implementing retry logic for failed webhook deliveries 