import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSystemInstruction } from './promptTemplates.js';

export async function generateDocFromDiff(
  apiKey: string,
  modelName: string,
  systemInstruction: string, // Kept for backwards compatibility but ignored
  userMessage: string,
  isBootstrap: boolean = false
): Promise<string> {
  if (!apiKey) throw new Error("Gemini API key is required");
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: getSystemInstruction(isBootstrap),
  });

  const result = await model.generateContent(userMessage);
  const response = await result.response;
  return response.text();
}
