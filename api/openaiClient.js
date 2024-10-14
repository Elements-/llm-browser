import OpenAI from 'openai';


const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('Error: OpenAI API key not set. Please set the OPENAI_API_KEY environment variable.');
  process.exit(1);
}

export const openaiClient = new OpenAI({
  apiKey: apiKey,
});