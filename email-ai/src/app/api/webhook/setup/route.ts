import { NextRequest, NextResponse } from 'next/server';
import { createGmailWebhookManager } from '../../../../lib/gmail-webhook';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, topicName, labelIds } = body;

    // Validate required parameters
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 400 }
      );
    }

    if (!topicName) {
      return NextResponse.json(
        { error: 'Topic name is required' },
        { status: 400 }
      );
    }

    console.log('🔧 Setting up Gmail webhook subscription...');
    console.log('📧 Topic:', topicName);
    console.log('🏷️ Labels:', labelIds || ['INBOX']);

    // Create webhook manager and set up notifications
    const webhookManager = createGmailWebhookManager(accessToken);
    const result = await webhookManager.setupPushNotifications(
      topicName,
      labelIds || ['INBOX']
    );

    console.log('✅ Webhook subscription set up successfully');

    return NextResponse.json({
      success: true,
      message: 'Gmail webhook subscription created successfully',
      data: result
    });

  } catch (error) {
    console.error('❌ Error setting up webhook subscription:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to set up webhook subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Gmail webhook setup endpoint',
    instructions: 'Send a POST request with accessToken and topicName to set up webhook subscriptions',
    example: {
      method: 'POST',
      body: {
        accessToken: 'your-gmail-access-token',
        topicName: 'projects/your-project/topics/gmail-notifications',
        labelIds: ['INBOX', 'SENT'] // optional
      }
    }
  });
} 