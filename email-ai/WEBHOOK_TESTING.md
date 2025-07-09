# Webhook Testing Guide

Quick guide for testing the Gmail webhook locally using ngrok.

## 🚀 Quick Start

### Option 1: Automated Testing (Recommended)

```bash
# Install dependencies
npm install

# Run the quick test script (starts app, ngrok, and tests automatically)
npm run webhook:quick-test
```

### Option 2: Manual Testing

```bash
# 1. Start development server with ngrok tunnel
npm run dev:tunnel

# 2. Get your ngrok URL from http://localhost:4040

# 3. Test the webhook
npm run webhook:test

# 4. Test with ngrok URL (replace with your actual URL)
WEBHOOK_URL=https://your-ngrok-url.ngrok.io/api/webhook/gmail npm run webhook:test
```

## 📋 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run tunnel` | Start ngrok tunnel only |
| `npm run dev:tunnel` | Start both dev server and ngrok |
| `npm run webhook:test` | Test webhook with localhost |
| `npm run webhook:test:ngrok` | Test webhook with ngrok URL |
| `npm run webhook:quick-test` | Full automated test setup |

## 🔧 Configuration

### ngrok Setup

1. **Sign up for ngrok** (free): https://ngrok.com/
2. **Get your auth token** from ngrok dashboard
3. **Update ngrok.yml**:
   ```bash
   # Replace with your actual auth token
   sed -i 's/your-ngrok-auth-token-here/YOUR_ACTUAL_AUTH_TOKEN/' ngrok.yml
   ```

### Environment Variables

```bash
# For testing with custom webhook URL
export WEBHOOK_URL=https://your-ngrok-url.ngrok.io/api/webhook/gmail
```

## 🧪 Test Scenarios

The test script automatically runs these scenarios:

1. **Valid Pub/Sub message** - Tests proper message format
2. **Invalid message format** - Tests error handling
3. **GET request** - Tests endpoint information
4. **Setup endpoint** - Tests webhook configuration

## 📊 Monitoring

- **ngrok Dashboard**: http://localhost:4040
- **App Dashboard**: http://localhost:3000
- **Webhook Logs**: Check your terminal/console

## 🔍 Manual Testing

### Test with curl

```bash
# Test GET endpoint
curl -X GET https://your-ngrok-url.ngrok.io/api/webhook/gmail

# Test POST with sample data
curl -X POST https://your-ngrok-url.ngrok.io/api/webhook/gmail \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "data": "eyJlbWFpbEFkZHJlc3MiOiJ0ZXN0QGdtYWlsLmNvbSIsImhpc3RvcnlJZCI6IjEyMzQ1In0=",
      "messageId": "test-123"
    }
  }'
```

### Test with Google Cloud Pub/Sub

```bash
# Publish test message to your topic
gcloud pubsub topics publish gmail-notifications \
  --message='{"emailAddress":"test@gmail.com","historyId":"12345"}'
```

## 🛠️ Troubleshooting

### Common Issues

1. **ngrok not found**: Install with `npm install -g ngrok`
2. **Port 3000 in use**: Kill existing process or change port
3. **Auth token error**: Check ngrok.yml configuration
4. **Webhook not responding**: Check if app is running

### Debug Commands

```bash
# Check if app is running
curl http://localhost:3000

# Check ngrok status
curl http://localhost:4040/api/tunnels

# View ngrok logs
tail -f ~/.ngrok2/ngrok.log
```

## 📝 Notes

- ngrok URLs change each time you restart the tunnel
- Free ngrok accounts have rate limits
- HTTPS is required for Google Pub/Sub webhooks
- Test with real Gmail notifications for full validation 