import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';

let genAI = null;
let model = null;

function getModel() {
    if (!model) {
        genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
        model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    }
    return model;
}

export async function POST({ request }) {
    try {
        if (!env.GEMINI_API_KEY) {
            return json({ error: 'GEMINI_API_KEY is not set' }, { status: 500 });
        }

        const { prompt, audioData, mimeType } = await request.json();

        const result = await getModel().generateContent([
            prompt,
            {
                inlineData: {
                    data: audioData,
                    mimeType: mimeType
                }
            }
        ]);

        const response = await result.response;
        const text = response.text();

        return json({ text });
    } catch (error) {
        console.error("Error in Gemini API route:", error);
        return json({ error: 'Transcription failed. Please try again.' }, { status: 500 });
    }
}
