import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getGmailMessages, getEmailContent } from '../../../../lib/google';

const prisma = new PrismaClient();

interface GmailNotification {
  emailAddress?: string;
  historyId?: string;
  expiration?: string;
  [key: string]: unknown;
}

// Verify the webhook is from Google Pub/Sub
const verifyPubSubMessage = async (request: NextRequest): Promise<GmailNotification | null> => {
  try {
    const body = await request.json();
    
    // Check if this is a Pub/Sub push message
    if (body.message && body.message.data) {
      // Decode the base64 data
      const decodedData = Buffer.from(body.message.data, 'base64').toString('utf-8');
      return JSON.parse(decodedData);
    }
    
    return null;
  } catch (error) {
    console.error('Error verifying Pub/Sub message:', error);
    return null;
  }
};

// Process new email notification
const processNewEmail = async (emailData: GmailNotification) => {
  try {
    console.log('🔔 New email notification received!');
    console.log('📧 Email address:', emailData.emailAddress);
    console.log('📅 History ID:', emailData.historyId);
    console.log('📋 Full notification data:', JSON.stringify(emailData, null, 2));
    
    if (!emailData.emailAddress) {
      console.log('⚠️ No email address in notification');
      return;
    }

    // Get user's access token from database
    const user = await prisma.user.findUnique({
      where: { email: emailData.emailAddress! }
    });

    if (!user) {
      console.log('⚠️ User not found in database:', emailData.emailAddress!);
      return;
    }

    console.log('👤 User found:', user.name);

    // Fetch recent emails (last 5) to get the new ones
    const recentEmails = await getGmailMessages(user.accessToken, {
      maxResults: 5,
      query: 'is:unread' // Get unread emails first
    });

    if (!recentEmails.messages || recentEmails.messages.length === 0) {
      console.log('📭 No recent emails found');
      return;
    }

    console.log(`📬 Found ${recentEmails.messages.length} recent emails`);

    // Get detailed content for each email
    for (const message of recentEmails.messages) {
      try {
        const emailContent = await getEmailContent(user.accessToken, message.id!);
        
        console.log('\n📧 NEW EMAIL DETAILS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📨 From: ${emailContent.from}`);
        console.log(`📋 Subject: ${emailContent.subject}`);
        console.log(`📅 Date: ${emailContent.date}`);
        console.log(`📝 Snippet: ${emailContent.snippet}`);
        console.log(`📄 Body Preview: ${emailContent.body.substring(0, 200)}${emailContent.body.length > 200 ? '...' : ''}`);
        console.log(`⭐ Starred: ${emailContent.starred ? 'Yes' : 'No'}`);
        console.log(`🆔 Message ID: ${emailContent.id}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
      } catch (error) {
        console.error(`❌ Error fetching email ${message.id}:`, error);
      }
    }
    
    console.log('✅ Email notification processed successfully');
    
  } catch (error) {
    console.error('❌ Error processing email notification:', error);
  }
};

export async function POST(request: NextRequest) {
  try {
    console.log('🌐 Webhook endpoint called');
    
    // Verify the request is from Google Pub/Sub
    const emailData = await verifyPubSubMessage(request);
    
    if (!emailData) {
      console.log('⚠️ Invalid Pub/Sub message format');
      return NextResponse.json({ error: 'Invalid message format' }, { status: 400 });
    }
    
    // Process the new email notification
    await processNewEmail(emailData);
    
    // Return success response to acknowledge receipt
    return NextResponse.json({ 
      success: true, 
      message: 'Email notification received and processed' 
    });
    
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

// Handle GET requests (for testing the endpoint)
export async function GET() {
  return NextResponse.json({ 
    message: 'Gmail webhook endpoint is active',
    instructions: 'This endpoint expects POST requests from Google Pub/Sub with new email notifications'
  });
} 