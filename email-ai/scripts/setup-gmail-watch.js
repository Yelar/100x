const { PrismaClient } = require('@prisma/client');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');

const PUBSUB_TOPIC = 'projects/x-email-462014/topics/hundredX';

const prisma = new PrismaClient();

// Function to refresh access token
async function refreshAccessToken(refreshToken) {
  try {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    // Update the database with new tokens
    await prisma.user.updateMany({
      where: { refreshToken: refreshToken },
      data: {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || refreshToken, // Keep old refresh token if new one not provided
        updatedAt: new Date()
      }
    });
    
    console.log('🔄 Access token refreshed successfully');
    return credentials.access_token;
  } catch (error) {
    console.error('❌ Failed to refresh access token:', error.message);
    throw error;
  }
}

// Gmail webhook manager class (inline to avoid import issues)
class GmailWebhookManager {
  constructor(accessToken) {
    this.oauth2Client = new OAuth2Client();
    this.oauth2Client.setCredentials({ access_token: accessToken });
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  async setupPushNotifications(topicName, labelIds = ['INBOX']) {
    try {
      console.log('🔧 Setting up Gmail push notifications...');
      console.log('📧 Topic:', topicName);
      console.log('🏷️ Labels:', labelIds);

      const response = await this.gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: topicName,
          labelIds: labelIds,
          labelFilterAction: 'include'
        }
      });

      console.log('✅ Push notifications set up successfully');
      console.log('🆔 History ID:', response.data.historyId);
      console.log('⏰ Expiration:', response.data.expiration);

      return {
        success: true,
        historyId: response.data.historyId,
        expiration: response.data.expiration
      };

    } catch (error) {
      console.error('❌ Error setting up push notifications:', error);
      throw error;
    }
  }
}

async function setupWatchForAllUsers() {
  try {
    console.log('🚀 Starting Gmail watch setup for all users...\n');
    
    const users = await prisma.user.findMany();
    
    if (!users.length) {
      console.log('📭 No users found in the database.');
      return;
    }

    console.log(`👥 Found ${users.length} users in database\n`);

    for (const user of users) {
      try {
        console.log(`⚡ Setting up watch for: ${user.email}`);
        
        let accessToken = user.accessToken;
        
        // Try with current access token first
        try {
          const manager = new GmailWebhookManager(accessToken);
          const result = await manager.setupPushNotifications(PUBSUB_TOPIC);
          
          console.log(`✅ Watch set up for ${user.email}`);
          console.log(`   History ID: ${result.historyId}`);
          console.log(`   Expiration: ${result.expiration}\n`);
          continue; // Success, move to next user
          
        } catch (err) {
          // If it's an auth error, try to refresh the token
          if (err.code === 401 && user.refreshToken) {
            console.log(`🔄 Access token expired for ${user.email}, attempting to refresh...`);
            
            try {
              accessToken = await refreshAccessToken(user.refreshToken);
              
              // Try again with refreshed token
              const manager = new GmailWebhookManager(accessToken);
              const result = await manager.setupPushNotifications(PUBSUB_TOPIC);
              
              console.log(`✅ Watch set up for ${user.email} (after token refresh)`);
              console.log(`   History ID: ${result.historyId}`);
              console.log(`   Expiration: ${result.expiration}\n`);
              continue; // Success, move to next user
              
            } catch (refreshErr) {
              console.error(`❌ Failed to refresh token for ${user.email}:`);
              console.error(`   Error: ${refreshErr.message || refreshErr}\n`);
            }
          }
          
          // If we get here, either it's not an auth error or refresh failed
          console.error(`❌ Failed to set up watch for ${user.email}:`);
          console.error(`   Error: ${err.message || err}\n`);
        }
        
      } catch (err) {
        console.error(`❌ Unexpected error for ${user.email}:`);
        console.error(`   Error: ${err.message || err}\n`);
      }
    }
    
    console.log('🎉 Gmail watch setup completed!');
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
setupWatchForAllUsers(); 