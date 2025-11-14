import { json } from "@sveltejs/kit";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY } from "$env/static/private";

const API_TIMEOUT_MS = 30000;

if (!GEMINI_API_KEY) {
  console.warn(
    "[ZipList /api/transcribe] GEMINI_API_KEY is not set. Requests will fail.",
  );
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const model = genAI
  ? genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        candidateCount: 1,
        maxOutputTokens: 8192,
      },
    })
  : null;

function base64ToGenerativePart(base64Data, mimeType) {
  return {
    inlineData: {
      data: base64Data,
      mimeType,
    },
  };
}

export async function POST({ request }) {
  if (!model) {
    return json(
      {
        error:
          "Gemini API is not configured. Please set GEMINI_API_KEY on the server.",
      },
      { status: 500 },
    );
  }

  try {
    const {
      audioData,
      mimeType,
      prompt,
      promptStyle = "standard",
    } = await request.json();

    if (!audioData || !mimeType || !prompt) {
      return json(
        {
          error:
            "Missing audio, mime type, or prompt. Please try recording again.",
        },
        { status: 400 },
      );
    }

    const audioSizeKB = ((audioData.length * 0.75) / 1024).toFixed(2);
    console.log(
      `[ZipList /api/transcribe] audio=${audioSizeKB}KB mime=${mimeType} style=${promptStyle}`,
    );

    const audioPart = base64ToGenerativePart(audioData, mimeType);

    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error("timeout")),
        API_TIMEOUT_MS,
      );
    });

    const geminiPromise = model.generateContent([
      {
        text: prompt,
      },
      audioPart,
    ]);

    const result = await Promise.race([geminiPromise, timeoutPromise]);
    clearTimeout(timeoutId);
    const transcription = result.response.text();
    console.log(
      `[ZipList /api/transcribe] ✅ success (${transcription.length} chars returned)`,
    );

    return json({ transcription });
  } catch (error) {
    const message = error?.message || "Unknown error";
    let friendlyMessage =
      "Oops, the transcription service hit a snag. Give it another go in a moment?";

    if (message === "timeout") {
      friendlyMessage =
        "Transcription took too long (30s timeout). Try a shorter recording?";
    } else if (message.includes("quota")) {
      friendlyMessage =
        "Looks like we hit our daily Gemini limit. Try again in a little while?";
    } else if (message.includes("network")) {
      friendlyMessage =
        "We couldn't reach Gemini. Mind checking your connection?";
    }

    return json({ error: friendlyMessage }, { status: 500 });
  }
}
