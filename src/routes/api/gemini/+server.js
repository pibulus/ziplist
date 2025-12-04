import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

export async function POST({ request }) {
    try {
        const { prompt, audioData, mimeType } = await request.json();

        if (!env.GEMINI_API_KEY) {
            return json({ error: 'GEMINI_API_KEY is not set' }, { status: 500 });
        }

        const result = await model.generateContent([
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
        return json({ error: error.message }, { status: 500 });
    }
}
