#!/bin/bash

# Quick test script for Gmail webhook with ngrok
# This script helps you quickly test the webhook locally

set -e

echo "🚀 Gmail Webhook Quick Test"
echo "=========================="

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed. Please install it first:"
    echo "   npm install -g ngrok"
    echo "   or download from https://ngrok.com/"
    exit 1
fi

# Check if the app is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "⚠️  App is not running on localhost:3000"
    echo "   Starting development server..."
    npm run dev &
    sleep 5
fi

echo "✅ App is running on localhost:3000"

# Start ngrok tunnel
echo "🌐 Starting ngrok tunnel..."
ngrok http 3000 > /dev/null &
NGROK_PID=$!

# Wait for ngrok to start
sleep 3

# Get ngrok URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$NGROK_URL" ]; then
    echo "❌ Failed to get ngrok URL"
    kill $NGROK_PID 2>/dev/null || true
    exit 1
fi

echo "✅ ngrok tunnel active: $NGROK_URL"
echo "📊 ngrok dashboard: http://localhost:4040"

# Test the webhook
echo ""
echo "🧪 Testing webhook..."
WEBHOOK_URL="$NGROK_URL/api/webhook/gmail" npm run webhook:test

echo ""
echo "🎉 Test completed!"
echo ""
echo "📋 Next steps:"
echo "   1. Use this URL for Google Pub/Sub: $NGROK_URL/api/webhook/gmail"
echo "   2. Configure your Google Cloud Pub/Sub subscription"
echo "   3. Test with real Gmail notifications"
echo ""
echo "Press Ctrl+C to stop ngrok tunnel"

# Wait for user to stop
trap "echo ''; echo '🛑 Stopping ngrok...'; kill $NGROK_PID 2>/dev/null || true; exit" INT
wait $NGROK_PID 