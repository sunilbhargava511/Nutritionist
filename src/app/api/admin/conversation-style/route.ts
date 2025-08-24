import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/database';
import { conversationStyle } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const settings = await getDB()
      .select()
      .from(conversationStyle)
      .where(eq(conversationStyle.id, 'default'))
      .limit(1);

    if (settings.length === 0) {
      // Return default settings if none exist
      return NextResponse.json({
        success: true,
        settings: {
          basePersona: 'default',
          gender: 'female',
          customPerson: '',
          enhancedPrompt: 'You are a knowledgeable nutrition educator providing clear, evidence-based information.'
        }
      });
    }

    return NextResponse.json({
      success: true,
      settings: {
        basePersona: settings[0].basePersona,
        gender: settings[0].gender,
        customPerson: settings[0].customPerson,
        enhancedPrompt: settings[0].enhancedPrompt
      }
    });

  } catch (error) {
    console.error('Error fetching conversation style:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch conversation style' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { basePersona, gender, customPerson, enhancedPrompt } = body;

    if (!basePersona || !gender || enhancedPrompt === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: basePersona, gender, enhancedPrompt' },
        { status: 400 }
      );
    }

    // Insert or update the conversation style
    await getDB()
      .insert(conversationStyle)
      .values({
        id: 'default',
        basePersona,
        gender: gender as 'male' | 'female',
        customPerson: customPerson || '',
        enhancedPrompt,
        updatedAt: new Date().toISOString()
      })
      .onConflictDoUpdate({
        target: conversationStyle.id,
        set: {
          basePersona,
          gender: gender as 'male' | 'female',
          customPerson: customPerson || '',
          enhancedPrompt,
          updatedAt: new Date().toISOString()
        }
      });

    console.log('Conversation style saved:', { basePersona, gender, customPerson: customPerson ? 'set' : 'empty' });

    return NextResponse.json({
      success: true,
      message: 'Conversation style saved successfully'
    });

  } catch (error) {
    console.error('Error saving conversation style:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save conversation style' },
      { status: 500 }
    );
  }
}