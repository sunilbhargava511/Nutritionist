import { NextRequest, NextResponse } from 'next/server';
import { getClaudeService } from '@/lib/claude';
import { getDB } from '@/lib/database';
import * as schema from '@/lib/database/schema';

// Get persona settings from conversation style
async function getPersonaSettings() {
  try {
    const personas = await getDB().select().from(schema.conversationStyle).limit(1);
    if (personas.length === 0) {
      return null;
    }
    
    const persona = personas[0];
    let prompt = '';
    
    if (persona.basePersona === 'custom' && persona.customPerson) {
      prompt = persona.customPerson;
    } else if (persona.basePersona === 'nutritionist') {
      const genderText = persona.gender === 'male' ? 'He is' : 'She is';
      prompt = `You are a knowledgeable nutrition educator. ${genderText} professional, evidence-based, and passionate about helping people improve their relationship with food and health.`;
    } else {
      prompt = 'You are a knowledgeable nutrition educator providing clear, evidence-based information.';
    }
    
    return {
      basePersona: persona.basePersona,
      gender: persona.gender,
      prompt,
      customPerson: persona.customPerson
    };
  } catch (error) {
    console.error('Error getting persona settings:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, contentType, businessInfo } = body;

    if (!content || !contentType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: content, contentType' },
        { status: 400 }
      );
    }

    // Get persona settings for styling
    const personaSettings = await getPersonaSettings();
    const claudeService = getClaudeService();
    
    // Create styling prompt based on content type
    let styledContent = '';
    
    if (contentType === 'serviceDescription') {
      styledContent = await styleServiceDescription(claudeService, content, personaSettings, businessInfo);
    } else if (contentType === 'keyBenefits') {
      styledContent = await styleKeyBenefits(claudeService, content, personaSettings, businessInfo);
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid contentType. Use: serviceDescription or keyBenefits' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      originalContent: content,
      styledContent: styledContent,
      contentType: contentType,
      persona: personaSettings,
      description: `${contentType} styled successfully`
    });

  } catch (error) {
    console.error('Error styling service content:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to style service content' },
      { status: 500 }
    );
  }
}

async function styleServiceDescription(
  claudeService: any, 
  content: string, 
  personaSettings: any, 
  businessInfo?: any
) {
  const basePersona = personaSettings?.prompt || 'You are a knowledgeable nutrition educator providing clear, evidence-based information.';
  
  let businessContext = '';
  if (businessInfo?.businessName) {
    businessContext = `\nBusiness Context: This description is for ${businessInfo.businessName}`;
    if (businessInfo.email) businessContext += ` (contact: ${businessInfo.email})`;
  }
  
  const stylePrompt = `${basePersona}

Take this service description and enhance it to be more engaging, professional, and compelling while preserving all the factual information. The description should be:
- Warm and professional in tone
- Clearly structured with natural flow
- Emphasize benefits and outcomes for clients
- Use active voice and compelling language
- Suitable for website content and marketing materials
- Maintain credibility and expertise${businessContext}

Original service description:
"${content}"

Please provide only the enhanced service description:`;

  const response = await claudeService.client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 800,
    temperature: 0.7,
    messages: [{
      role: 'user',
      content: stylePrompt
    }]
  });

  const responseContent = response.content[0];
  return responseContent.type === 'text' ? responseContent.text : content;
}

async function styleKeyBenefits(
  claudeService: any, 
  content: string, 
  personaSettings: any, 
  businessInfo?: any
) {
  const basePersona = personaSettings?.prompt || 'You are a knowledgeable nutrition educator providing clear, evidence-based information.';
  
  let businessContext = '';
  if (businessInfo?.businessName) {
    businessContext = `\nBusiness Context: These benefits are for ${businessInfo.businessName}`;
  }
  
  const stylePrompt = `${basePersona}

Take this list of key benefits and enhance them to be more compelling and client-focused while maintaining accuracy. Each benefit should be:
- Action-oriented and results-focused
- Clear and concise (1-2 lines each)
- Emphasize value to the client
- Use powerful, positive language
- Maintain one benefit per line format${businessContext}

Original key benefits:
"${content}"

Please provide only the enhanced key benefits list (one per line):`;

  const response = await claudeService.client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 400,
    temperature: 0.7,
    messages: [{
      role: 'user',
      content: stylePrompt
    }]
  });

  const responseContent = response.content[0];
  return responseContent.type === 'text' ? responseContent.text : content;
}