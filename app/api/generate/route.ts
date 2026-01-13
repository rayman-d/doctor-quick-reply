import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || 'You are a helpful assistant that helps doctors draft replies to patient messages.';

export async function POST(request: Request) {
  try {
    const { classification, patient_messages } = await request.json();

    if (!classification || !patient_messages) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Classification: ${classification}\n\nPatient Messages:\n${patient_messages}`,
        },
      ],
      temperature: 0.7,
    });

    const ai_reply = completion.choices[0]?.message?.content || '';

    const { data, error } = await supabase
      .from('replies')
      .insert({
        classification,
        patient_messages,
        ai_reply,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      id: data.id,
      ai_reply,
    });
  } catch (error: any) {
    console.error('Generate error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}