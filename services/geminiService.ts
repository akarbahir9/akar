import { GoogleGenAI, Modality } from "@google/genai";
import type { ImagePart, AspectRatio } from '../types';

// Initialize the Google AI client.
// The API key is expected to be set in the environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Converts a File object to a base64 encoded string for the Gemini API.
 * @param file The file to convert.
 * @returns A promise that resolves to an ImagePart object.
 */
const fileToGenerativePart = async (file: File): Promise<ImagePart> => {
  const base64EncodedData = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  return {
    inlineData: {
      mimeType: file.type,
      data: base64EncodedData,
    },
  };
};

/**
 * Analyzes a reference scene and a subject image, considers a user prompt,
 * and generates a new master prompt while also cleaning the reference scene.
 * @param referenceFile The reference image file (containing pose, scene, etc.).
 * @param subjectFile The subject image file (person/object to add).
 * @param userPrompt Any additional text prompt from the user.
 * @returns An object containing the cleaned image part and the generated master prompt.
 */
export const analyzeSceneAndSubjectForPrompt = async (
  referenceFile: File,
  subjectFile: File,
  userPrompt: string
): Promise<{ cleanedReferencePart: ImagePart; generatedPrompt: string }> => {
  const referencePart = await fileToGenerativePart(referenceFile);
  const subjectPart = await fileToGenerativePart(subjectFile);

  // --- Step 1: Clean the reference image by removing the person and logos ---
  const cleaningContents = {
    parts: [
      referencePart,
      { text: "Carefully and realistically remove the person from this image. Also remove any visible logos, text, or icons. Inpaint the background where the person and logos were, making it look natural and seamless as if they were never there. The final image must be a clean version of the background scene, maintaining the original quality and aspect ratio." }
    ]
  };

  const cleaningResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image-preview',
    contents: cleaningContents,
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });
  
  let cleanedReferencePart: ImagePart | null = null;
  if (cleaningResponse.candidates && cleaningResponse.candidates[0].content && cleaningResponse.candidates[0].content.parts) {
    for (const part of cleaningResponse.candidates[0].content.parts) {
      if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
        cleanedReferencePart = {
          inlineData: {
            mimeType: part.inlineData.mimeType,
            data: part.inlineData.data,
          }
        };
        break;
      }
    }
  }

  if (!cleanedReferencePart) {
    throw new Error("Image cleaning failed: The model did not return a cleaned image.");
  }

  // --- Step 2: Analyze both images and the user prompt to generate a master prompt ---
  const analysisParts = [
      { text: `You are a world-class photoshoot director, creating a master prompt for an AI artist. Your task is to synthesize information from three sources: a Reference Image (for scene, pose, and style), a Subject Image (for the person's identity), and a User Request (for specific instructions).

**Your Process:**
1.  **Deconstruct the Reference Image:** Analyze its technical and artistic qualities. Do NOT describe the person in it, only their pose and the environment.
    *   **Pose & Composition:** Detail the precise body language, weight distribution, and placement within the frame (e.g., 'rule of thirds').
    *   **Camera & Lens:** Specify the shot type, angle, and lens characteristics (e.g., 'Low-angle medium shot, 50mm f/1.8 lens, shallow depth of field').
    *   **Lighting:** Describe the lighting setup (e.g., 'Golden hour sunlight from the back-right, creating a strong rim light').
    *   **Color & Mood:** Define the color grade and overall atmosphere (e.g., 'Cinematic teal and orange grade, moody and contemplative').

2.  **Identify the Subject:** Look at the Subject Image only to understand the person's face, hair, and general appearance. IGNORE the pose, lighting, and background from this image.

3.  **Integrate User Request:** Weave the user's specific text instructions into your final plan.

**Your Output:**
Combine everything into a single, dense, hyper-detailed paragraph. This is the final master prompt. It must instruct the AI to place the identified **Subject** into the scene, perfectly adopting the **pose, mood, and all technical characteristics** from the Reference Image, while fulfilling the User Request.` },
      { text: "--- REFERENCE IMAGE (SCENE & POSE) ---"},
      referencePart,
      { text: "--- SUBJECT IMAGE (PERSON TO PLACE) ---"},
      subjectPart,
      { text: `--- USER'S SPECIFIC REQUEST --- \n"${userPrompt || 'None'}"` }
  ];
  
  const analysisResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: analysisParts },
  });

  const generatedPrompt = analysisResponse.text.trim();

  return { cleanedReferencePart, generatedPrompt };
};

/**
 * Enhances a user's creative prompt using AI.
 * @param prompt The user's prompt.
 * @param referenceParts Reference images.
 * @param subjectImages Subject images.
 * @param avoidPrompt Negative prompt.
 * @returns An enhanced prompt string.
 */
export const enhancePromptWithAI = async (
  prompt: string,
  referenceParts: ImagePart[],
  subjectImages: File[],
  avoidPrompt:string
): Promise<string> => {
  const subjectParts = await Promise.all(subjectImages.map(fileToGenerativePart));
  
  const allParts = [
    { text: "You are a creative assistant and expert prompt engineer. Enhance the user's prompt to be more vivid and detailed for an AI image generator. Combine the user's idea with visual cues from the reference and subject images. Consider the negative prompt. Output only the final, enhanced prompt string." },
    ...referenceParts,
    ...subjectParts,
    { text: `User's core idea: "${prompt}"` },
    { text: `Elements to avoid: "${avoidPrompt}"` },
  ];

  const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: allParts },
  });
  
  return response.text.trim();
};

/**
 * Enhances a negative prompt using AI.
 * @param avoidPrompt The user's negative prompt.
 * @returns An enhanced negative prompt string.
 */
export const enhanceAvoidPromptWithAI = async (avoidPrompt: string): Promise<string> => {
  const contents = `You are an expert in crafting negative prompts for AI image generation. Expand on the user's input with common terms to improve quality (e.g., 'blurry, low quality, bad anatomy').
User's input: "${avoidPrompt}"
Return a single, comma-separated, enhanced negative prompt.`;

  const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
  });
  
  return response.text.trim();
};

/**
 * Enhances an editing prompt using AI for context.
 * @param prompt The original creative prompt.
 * @param editPrompt The user's edit request.
 * @param avoidPrompt The negative prompt.
 * @returns An enhanced edit prompt string.
 */
export const enhanceEditPromptWithAI = async (
  prompt: string,
  editPrompt: string,
  avoidPrompt: string
): Promise<string> => {
  const contents = `You are an expert prompt engineer for an AI image editing model. Refine the user's edit request to be clear and effective, using the original prompt and negative prompt for context.
Original prompt context: "${prompt}"
Things to avoid: "${avoidPrompt}"
User's edit request: "${editPrompt}"
Generate a clear, enhanced edit instruction for the model. Output only the final edit prompt.`;

  const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
  });
  
  return response.text.trim();
};

/**
 * Generates or edits an image using the Gemini API.
 * @param prompt The main creative prompt.
 * @param referenceParts An array with the scene/location reference image.
 * @param subjectImages An array of subject images to place in the scene.
 * @param aspectRatio The desired aspect ratio (Note: not supported by the edit model).
 * @param avoidPrompt A negative prompt of things to avoid.
 * @param editPrompt An additional prompt for editing an existing generation.
 * @returns A promise that resolves to a data URL (base64) of the generated image.
 */
export const generateImageWithAI = async (
  prompt: string,
  referenceParts: ImagePart[], // Scene/Location (should be the cleaned version)
  subjectImages: File[], // People/Objects to add
  aspectRatio: AspectRatio,
  avoidPrompt: string,
  editPrompt: string
): Promise<string> => {
  
  const subjectParts = await Promise.all(subjectImages.map(fileToGenerativePart));

  let fullPrompt = `**Your Task: Photorealistic Scene Recreation.** You are an elite digital artist tasked with creating a completely new, hyper-realistic photograph. You must not simply "copy and paste". You must re-render the subject from scratch within the new scene to create a flawless, believable image.

**Inputs Breakdown & Roles:**
*   **IMAGE 1 (The Stage):** This is your background scene. The final photograph will take place here.
*   **IMAGE 2 (The Actor):** This image provides the identity of the person (face, general appearance). You MUST IGNORE EVERYTHING ELSE from this image: its background, the person's pose, their clothing (unless specified otherwise), and especially its lighting.
*   **TEXT PROMPT (The Script):** The text that follows is your script. It contains the *master instructions* for the final image. The person's pose, the camera angle, the lighting style, and the mood *must* come from this script, not from the actor's original image.

**Master Instructions (The Script):**
${prompt}

**Execution & Quality Mandates:**
1.  **Re-render, Don't Composite:** You MUST generate the subject within the scene, adopting the new pose from the script. The subject must perfectly inherit the lighting, shadows, color temperature, and ambient reflections of the background scene (The Stage).
2.  **Destroy the "AI Look":** Your output must be indistinguishable from a real photograph.
    *   **Texture:** Create realistic skin with pores and micro-details. Avoid plastic-like smoothness.
    *   **Anatomy:** Hands, eyes, and posture must be anatomically perfect.
    *   **Cohesion:** The grain, focus, and lens effects (like depth of field) of the subject must match the background scene perfectly.
3.  **Strictly Avoid:** ${avoidPrompt || 'A "cut and paste" look, mismatched lighting, artificial skin, bad anatomy, blurry details.'}
4.  **Specific Edit (if regenerating):** ${editPrompt || 'N/A'}

Produce one single, final image that looks like it was shot by a world-class photographer on location.`;
  
  // The first image part is the cleaned reference scene, followed by subjects.
  const allParts = [
    ...referenceParts, 
    ...subjectParts,
    { text: fullPrompt }
  ];

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image-preview',
    contents: {
      parts: allParts,
    },
    config: {
      // The model must be told to output an image.
      // FIX: Corrected typo from `Mod_TAG` to `Modality`.
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  // Extract the generated image data from the response.
  if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
        const base64ImageBytes: string = part.inlineData.data;
        const mimeType = part.inlineData.mimeType;
        return `data:${mimeType};base64,${base64ImageBytes}`;
      }
    }
  }

  throw new Error("Image generation failed: The model did not return an image. It may have refused the request.");
};
