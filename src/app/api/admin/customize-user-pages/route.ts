import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/database';
import { websiteConfig, openingMessages } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';
import { getClaudeService } from '@/lib/claude';

interface CustomizationRequest {
  serviceProvider: {
    businessName: string;
    email?: string;
    phoneNumber?: string;
    address?: string;
    website?: string;
  };
  serviceSummary: {
    serviceDescription: string;
    keyBenefits: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: CustomizationRequest = await request.json();
    const { serviceProvider, serviceSummary } = body;

    // Validate required fields
    if (!serviceProvider.businessName || !serviceSummary.serviceDescription) {
      return NextResponse.json(
        { success: false, error: 'Business name and service description are required' },
        { status: 400 }
      );
    }

    const db = getDB();
    const claudeService = getClaudeService();

    // 1. Update website configuration with customized terminology
    const customizedConfig = await generateWebsiteConfig(
      claudeService,
      serviceProvider,
      serviceSummary
    );

    await updateWebsiteConfig(db, customizedConfig);

    // 2. Update opening messages for voice conversations
    const customizedOpeningMessage = await generateOpeningMessage(
      claudeService,
      serviceProvider,
      serviceSummary
    );

    await updateOpeningMessage(db, customizedOpeningMessage);

    // 3. Note: Home page and lesson interface customization will be handled
    // by reading the updated service provider and service summary data
    // Those components already read from the database

    return NextResponse.json({
      success: true,
      message: 'User pages customized successfully',
      customizations: {
        businessName: serviceProvider.businessName,
        websiteConfig: customizedConfig,
        openingMessage: customizedOpeningMessage
      }
    });

  } catch (error) {
    console.error('Error customizing user pages:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to customize user pages' },
      { status: 500 }
    );
  }
}

async function generateWebsiteConfig(
  claudeService: any,
  serviceProvider: any,
  serviceSummary: any
) {
  const prompt = `Based on this service provider information, generate customized terminology for their educational platform:

Business: ${serviceProvider.businessName}
Service Description: ${serviceSummary.serviceDescription}
Key Benefits: ${serviceSummary.keyBenefits}

Generate appropriate terms for:
1. What to call educational content (instead of "Lessons")
2. How to describe educational content briefly
3. What to call open conversations (instead of "Chat")
4. How to describe open conversations briefly

Consider the service type and make it sound professional and appropriate for their audience.

Return ONLY a JSON object with this format:
{
  "lessonsName": "...",
  "lessonsDescription": "...",
  "conversationName": "...",
  "conversationDescription": "..."
}`;

  try {
    const response = await claudeService.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 300,
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const config = JSON.parse(content.text);
      return {
        lessonsName: config.lessonsName || 'Lessons',
        lessonsDescription: config.lessonsDescription || 'Educational content',
        conversationName: config.conversationName || 'Chat',
        conversationDescription: config.conversationDescription || 'Open conversation with AI'
      };
    }
  } catch (error) {
    console.error('Error generating website config:', error);
  }

  // Fallback to intelligent defaults based on business type
  const businessLower = serviceProvider.businessName.toLowerCase();
  const isNutrition = businessLower.includes('nutrition') || businessLower.includes('diet') || businessLower.includes('health');
  const isTherapy = businessLower.includes('therapy') || businessLower.includes('counseling') || businessLower.includes('mental');

  if (isNutrition) {
    return {
      lessonsName: 'Nutrition Guides',
      lessonsDescription: 'Evidence-based nutrition education',
      conversationName: 'Nutrition Chat',
      conversationDescription: 'Personalized nutrition guidance'
    };
  } else if (isTherapy) {
    return {
      lessonsName: 'Learning Modules',
      lessonsDescription: 'Therapeutic educational content',
      conversationName: 'Support Chat',
      conversationDescription: 'Confidential support conversations'
    };
  } else {
    return {
      lessonsName: 'Educational Content',
      lessonsDescription: 'Professional learning materials',
      conversationName: 'Consultation',
      conversationDescription: 'Expert guidance and support'
    };
  }
}

async function generateOpeningMessage(
  claudeService: any,
  serviceProvider: any,
  serviceSummary: any
) {
  // Extract provider name from business name (remove titles, credentials, etc.)
  const providerName = extractProviderName(serviceProvider.businessName);
  
  const prompt = `Create a warm, professional opening message for voice conversations with this service provider:

Provider: ${providerName}
Business: ${serviceProvider.businessName}
Service Description: ${serviceSummary.serviceDescription}

The opening message should:
- Be 2-3 sentences maximum
- Sound natural for text-to-speech
- Introduce the provider personally
- Invite the user to share what they'd like help with
- Match the professional tone of their service
- Avoid complex punctuation or abbreviations

Return only the opening message text.`;

  try {
    const response = await claudeService.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 200,
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text.replace(/"/g, '').trim();
    }
  } catch (error) {
    console.error('Error generating opening message:', error);
  }

  // Fallback message
  return `Hello! I'm ${providerName}, and I'm here to help you with your questions and provide personalized guidance. What would you like to discuss today?`;
}

function extractProviderName(businessName: string): string {
  // Remove common business suffixes and titles
  let name = businessName
    .replace(/,?\s*(LLC|Inc|Corp|Ltd|RD|MD|PhD|LCSW|LPC|LMFT|CPA|JD)\.?$/gi, '')
    .replace(/,?\s*(Registered Dietitian|Licensed Clinical Social Worker|Licensed Professional Counselor)$/gi, '')
    .replace(/^(Dr\.?|Doctor|Professor|Prof\.?)\s+/gi, '')
    .trim();

  // If it looks like a person's name (2-3 words), return it
  const words = name.split(' ').filter(w => w.length > 0);
  if (words.length >= 2 && words.length <= 3) {
    return words.join(' ');
  }

  // Otherwise, return the first part before any comma or business indicators
  return name.split(',')[0].trim();
}

async function updateWebsiteConfig(db: any, config: any) {
  // Check if website config exists
  const existing = await db.select().from(websiteConfig).limit(1);
  
  if (existing.length > 0) {
    // Update existing
    await db.update(websiteConfig)
      .set({
        lessonsName: config.lessonsName,
        lessonsDescription: config.lessonsDescription,
        conversationName: config.conversationName,
        conversationDescription: config.conversationDescription,
        updatedAt: new Date().toISOString()
      })
      .where(eq(websiteConfig.id, 'default'));
  } else {
    // Create new
    await db.insert(websiteConfig).values({
      id: 'default',
      lessonsName: config.lessonsName,
      lessonsDescription: config.lessonsDescription,
      conversationName: config.conversationName,
      conversationDescription: config.conversationDescription
    });
  }
}

async function updateOpeningMessage(db: any, messageContent: string) {
  // Get all general opening messages (there might be duplicates)
  const allExisting = await db.select()
    .from(openingMessages)
    .where(eq(openingMessages.type, 'general_opening'));
  
  if (allExisting.length > 0) {
    // Update ALL general opening messages to ensure consistency
    await db.update(openingMessages)
      .set({
        messageContent: messageContent,
        updatedAt: new Date().toISOString(),
        // Clear cached audio since content changed
        audioUrl: null,
        audioBlob: null,
        audioGeneratedAt: null,
        audioHash: null
      })
      .where(eq(openingMessages.type, 'general_opening'));
  } else {
    // Create new
    const messageId = `opening_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.insert(openingMessages).values({
      id: messageId,
      type: 'general_opening',
      messageContent: messageContent,
      active: true
    });
  }
}