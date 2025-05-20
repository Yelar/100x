import { NextResponse } from 'next/server';

// Removed Edge runtime declaration to allow access to private env vars

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio');
    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json({ error: 'GROQ API key not set' }, { status: 500 });
    }

    // Use the global FormData to append the Blob directly
    const fd = new FormData();
    fd.append('file', audioFile, 'audio.webm');
    fd.append('model', 'whisper-large-v3-turbo');
    fd.append('response_format', 'json');

  
 
  
  
  
  
 
  


  

  
  
 
  
 
 
   const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        // Do not set Content-Type; fetch will set it automatically for FormData
      },
      body: fd,
    });

    if (!groqRes.ok) {
      const error = await groqRes.text();
      return NextResponse.json({ error: 'Groq API error', details: error }, { status: 500 });
    }

    const data = await groqRes.json();
    return NextResponse.json({ text: data.text });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error', details: (e as Error).message }, { status: 500 });
  }
} 