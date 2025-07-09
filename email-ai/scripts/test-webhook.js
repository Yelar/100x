#!/usr/bin/env node

/**
 * Test script for Gmail webhook
 * Simulates Google Pub/Sub messages for testing
 */

const https = require('https');
const http = require('http');

// Configuration
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhook/gmail';
const USE_HTTPS = WEBHOOK_URL.startsWith('https');

// Sample Gmail notification data
const sampleGmailNotification = {
  emailAddress: "test@gmail.com",
  historyId: "12345",
  expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
  topicName: "projects/test-project/topics/gmail-notifications"
};

// Sample Pub/Sub message format
const samplePubSubMessage = {
  message: {
    data: Buffer.from(JSON.stringify(sampleGmailNotification)).toString('base64'),
    messageId: "test-message-id",
    publishTime: new Date().toISOString()
  },
  subscription: "projects/test-project/subscriptions/gmail-webhook-subscription"
};

/**
 * Send a test request to the webhook
 */
function sendTestRequest(data) {
  return new Promise((resolve, reject) => {
    const url = new URL(WEBHOOK_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || (USE_HTTPS ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Gmail-Webhook-Test/1.0'
      }
    };

    const client = USE_HTTPS ? https : http;
    const req = client.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseData
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(JSON.stringify(data));
    req.end();
  });
}

/**
 * Test different scenarios
 */
async function runTests() {
  console.log('🧪 Starting Gmail webhook tests...\n');
  console.log(`📍 Webhook URL: ${WEBHOOK_URL}\n`);

  // Test 1: Valid Pub/Sub message
  console.log('📝 Test 1: Valid Pub/Sub message');
  try {
    const response = await sendTestRequest(samplePubSubMessage);
    console.log(`✅ Status: ${response.statusCode}`);
    console.log(`📄 Response: ${response.body}\n`);
  } catch (error) {
    console.log(`❌ Error: ${error.message}\n`);
  }

  // Test 2: Invalid message format
  console.log('📝 Test 2: Invalid message format');
  try {
    const response = await sendTestRequest({ invalid: 'data' });
    console.log(`✅ Status: ${response.statusCode}`);
    console.log(`📄 Response: ${response.body}\n`);
  } catch (error) {
    console.log(`❌ Error: ${error.message}\n`);
  }

  // Test 3: GET request (should return endpoint info)
  console.log('📝 Test 3: GET request');
  try {
    const url = new URL(WEBHOOK_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || (USE_HTTPS ? 443 : 80),
      path: url.pathname,
      method: 'GET'
    };

    const client = USE_HTTPS ? https : http;
    const req = client.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log(`✅ Status: ${res.statusCode}`);
        console.log(`📄 Response: ${responseData}\n`);
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Error: ${error.message}\n`);
    });

    req.end();
  } catch (error) {
    console.log(`❌ Error: ${error.message}\n`);
  }

  // Test 4: Setup endpoint test
  console.log('📝 Test 4: Setup endpoint');
  try {
    const response = await sendTestRequest({
      accessToken: 'test-access-token',
      topicName: 'projects/test-project/topics/gmail-notifications'
    });
    console.log(`✅ Status: ${response.statusCode}`);
    console.log(`📄 Response: ${response.body}\n`);
  } catch (error) {
    console.log(`❌ Error: ${error.message}\n`);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { sendTestRequest, samplePubSubMessage }; 