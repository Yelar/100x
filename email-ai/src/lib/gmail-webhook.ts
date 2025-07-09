import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Gmail push notification setup utilities
export class GmailWebhookManager {
  private oauth2Client: OAuth2Client;
  private gmail: gmail_v1.Gmail;

  constructor(accessToken: string) {
    this.oauth2Client = new OAuth2Client();
    this.oauth2Client.setCredentials({ access_token: accessToken });
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  /**
   * Set up Gmail push notifications for a user
   * @param topicName The Pub/Sub topic name (e.g., 'projects/your-project/topics/gmail-notifications')
   * @param labelIds Optional array of label IDs to watch (default: ['INBOX'])
   */
  async setupPushNotifications(topicName: string, labelIds: string[] = ['INBOX']) {
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

  /**
   * Stop Gmail push notifications
   */
  async stopPushNotifications() {
    try {
      console.log('🛑 Stopping Gmail push notifications...');

      await this.gmail.users.stop({
        userId: 'me'
      });

      console.log('✅ Push notifications stopped successfully');
      return { success: true };

    } catch (error) {
      console.error('❌ Error stopping push notifications:', error);
      throw error;
    }
  }

  /**
   * Get the current push notification status
   */
  async getPushNotificationStatus() {
    try {
      console.log('📊 Getting push notification status...');

      const response = await this.gmail.users.getProfile({
        userId: 'me'
      });

      console.log('✅ Profile retrieved successfully');
      return {
        success: true,
        emailAddress: response.data.emailAddress,
        messagesTotal: response.data.messagesTotal,
        threadsTotal: response.data.threadsTotal,
        historyId: response.data.historyId
      };

    } catch (error) {
      console.error('❌ Error getting profile:', error);
      throw error;
    }
  }

  /**
   * Get history of changes since a specific history ID
   * @param historyId The history ID to start from
   * @param startHistoryId Optional starting history ID
   */
  async getHistory(historyId: string, startHistoryId?: string) {
    try {
      console.log('📜 Getting Gmail history...');
      console.log('🆔 History ID:', historyId);
      if (startHistoryId) {
        console.log('🚀 Start History ID:', startHistoryId);
      }

      const response = await this.gmail.users.history.list({
        userId: 'me',
        startHistoryId: startHistoryId || historyId,
        historyTypes: ['messageAdded', 'labelAdded', 'labelRemoved']
      });

      console.log('✅ History retrieved successfully');
      console.log('📊 History items:', response.data.history?.length || 0);

      return {
        success: true,
        history: response.data.history || [],
        nextPageToken: response.data.nextPageToken,
        historyId: response.data.historyId
      };

    } catch (error) {
      console.error('❌ Error getting history:', error);
      throw error;
    }
  }
}

/**
 * Helper function to create a GmailWebhookManager instance
 */
export const createGmailWebhookManager = (accessToken: string): GmailWebhookManager => {
  return new GmailWebhookManager(accessToken);
};

/**
 * Example usage and setup instructions
 */
export const WEBHOOK_SETUP_INSTRUCTIONS = `
🔧 Gmail Webhook Setup Instructions:

1. Create a Google Cloud Project and enable the Gmail API
2. Create a Pub/Sub topic for Gmail notifications
3. Set up authentication and get an access token
4. Call the setupPushNotifications method with your topic name
5. Configure your webhook endpoint to receive notifications

Example:
const webhookManager = createGmailWebhookManager(accessToken);
await webhookManager.setupPushNotifications('projects/your-project/topics/gmail-notifications');

Your webhook endpoint will be: https://your-domain.com/api/webhook/gmail
`; 