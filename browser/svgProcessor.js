import Groq from "groq-sdk";
import sharp from "sharp";
import crypto from "crypto";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// In-memory cache
const svgCache = new Map();

// Function to convert SVG to PNG with transparent background using sharp
async function convertSvgToPng(svgMarkup) {
  try {
    // Compute the average color of the SVG content
    const svgBuffer = Buffer.from(svgMarkup);
    const { dominant } = await sharp(svgBuffer)
      .resize({ width: 200 })
      .stats();

    const avgColor = dominant;

    // Determine the contrasting background color
    const brightness = (avgColor.r * 299 + avgColor.g * 587 + avgColor.b * 114) / 1000;
    const backgroundColor = brightness > 128 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };

    const pngBuffer = await sharp(svgBuffer)
      .resize({ width: 200 })
      .flatten({ background: backgroundColor }) // Fill transparent background with contrasting color
      .png()
      .toBuffer();

    return pngBuffer;
  } catch (error) {
    console.error("Error converting SVG to PNG:", error);
    throw error;
  }
}

// Function to generate a hash from SVG markup
function generateHash(svgMarkup) {
  return crypto.createHash('md5').update(svgMarkup).digest('hex');
}

// Function to process SVG markup and get a description
export async function processSVG(svgMarkup) {
  try {
    const hash = generateHash(svgMarkup);

    // Check if the description is already in the cache
    if (svgCache.has(hash)) {
      return svgCache.get(hash);
    }

    // Convert SVG to PNG
    const pngBuffer = await convertSvgToPng(svgMarkup);

    // Encode the PNG buffer to base64
    const base64Image = pngBuffer.toString("base64");

    // Prepare the chat input
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Describe the user interface element image in a few words.\n" +
            "Be concise, your output should never be longer than one sentence and should disregard sentence structure."
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${base64Image}`,
            },
          },
        ],
      },
    ];

    // Send the PNG data to the Groq API
    const response = await groq.chat.completions.create({
      messages: messages,
      model: "llama-3.2-11b-vision-preview",
      temperature: 0.3,
    });

    if (response.choices[0]?.message?.content) {
      const description = response.choices[0].message.content;
      // Store the description in the cache
      svgCache.set(hash, description);
      return description;
    } else {
      throw new Error("No description received from the Groq API.");
    }
  } catch (error) {
    console.error("Error in processSVG:", error);
    throw error;
  }
}
