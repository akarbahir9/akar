import React, { useState, useCallback, useEffect } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { AspectRatioSelector } from './components/AspectRatioSelector';
import { Spinner } from './components/Spinner';
import { enhancePromptWithAI, generateImageWithAI, enhanceAvoidPromptWithAI, enhanceEditPromptWithAI, analyzeSceneAndSubjectForPrompt } from './services/geminiService';
import { SparklesIcon } from './components/icons/SparklesIcon';
import { DownloadIcon } from './components/icons/DownloadIcon';
import type { AspectRatio, ImagePart } from './types';

interface ProcessedReference {
  file: File;
  part: ImagePart;
  posePrompt: string;
}

interface GeneratedImage {
  id: string;
  url: string;
  sourceReferenceFile: File;
}

function App() {
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [subjectImages, setSubjectImages] = useState<File[]>([]);
  const [prompt, setPrompt] = useState<string>('');
  const [avoidPrompt, setAvoidPrompt] = useState<string>('');
  const [editPrompt, setEditPrompt] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  const [isEnhancingAvoid, setIsEnhancingAvoid] = useState<boolean>(false);
  const [isEnhancingEdit, setIsEnhancingEdit] = useState<boolean>(false);
  const [isAnalyzingReference, setIsAnalyzingReference] = useState<boolean>(false);
  const [processedReferenceData, setProcessedReferenceData] = useState<ProcessedReference | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReferenceFilesChange = useCallback((files: File[]) => {
    setReferenceImages(files);
    setGeneratedImage(null);
    setProcessedReferenceData(null);
    if (files.length === 0) {
      setPrompt('');
    }
  }, []);
  
  const handleSubjectFilesChange = useCallback((files: File[]) => {
    setSubjectImages(files);
    setGeneratedImage(null);
    setProcessedReferenceData(null);
  }, []);

  useEffect(() => {
    const referenceFile = referenceImages[0];
    const subjectFile = subjectImages[0];

    if (referenceFile && subjectFile) {
        const performAnalysis = async () => {
            setIsAnalyzingReference(true);
            setError(null);
            setProcessedReferenceData(null);
            try {
                const { cleanedReferencePart, generatedPrompt } = await analyzeSceneAndSubjectForPrompt(
                    referenceFile,
                    subjectFile,
                    prompt 
                );
                setProcessedReferenceData({
                    file: referenceFile,
                    part: cleanedReferencePart,
                    posePrompt: generatedPrompt,
                });
                setPrompt(generatedPrompt);
            } catch (e) {
                setError("Failed to analyze images. Please try different ones or check the console for details.");
                console.error(e);
            } finally {
                setIsAnalyzingReference(false);
            }
        };
        performAnalysis();
    }
    // This effect should only re-run if the files themselves change.
    // The prompt is an input to the analysis, but shouldn't trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceImages, subjectImages]);


  const handleEnhancePrompt = useCallback(async () => {
    if (!prompt && subjectImages.length === 0 && referenceImages.length === 0) {
      setError("Please provide a prompt or some images to enhance.");
      return;
    }
    setError(null);
    setIsEnhancing(true);
    const referenceParts = processedReferenceData ? [processedReferenceData.part] : [];
    try {
      const enhanced = await enhancePromptWithAI(prompt, referenceParts, subjectImages, avoidPrompt);
      setPrompt(enhanced);
    } catch (e) {
      setError("Failed to enhance prompt. Please try again.");
      console.error(e);
    } finally {
      setIsEnhancing(false);
    }
  }, [prompt, processedReferenceData, subjectImages, avoidPrompt, referenceImages]);

  const handleEnhanceAvoidPrompt = useCallback(async () => {
    if (!avoidPrompt) {
      setError("Please provide something to avoid first.");
      return;
    }
     setError(null);
     setIsEnhancingAvoid(true);
    try {
      const enhanced = await enhanceAvoidPromptWithAI(avoidPrompt);
      setAvoidPrompt(enhanced);
    } catch (e) {
      setError("Failed to enhance avoid prompt. Please try again.");
      console.error(e);
    } finally {
      setIsEnhancingAvoid(false);
    }
  }, [avoidPrompt]);

  const handleEnhanceEditPrompt = useCallback(async () => {
    if (!editPrompt) {
      setError("Please write an edit request first.");
      return;
    }
    if (!prompt) {
      setError("Cannot enhance an edit without a main prompt for context.");
      return;
    }
    setError(null);
    setIsEnhancingEdit(true);
    try {
      const enhanced = await enhanceEditPromptWithAI(prompt, editPrompt, avoidPrompt);
      setEditPrompt(enhanced);
    } catch (e) {
      setError("Failed to enhance edit prompt. Please try again.");
      console.error(e);
    } finally {
      setIsEnhancingEdit(false);
    }
  }, [prompt, editPrompt, avoidPrompt]);

  const handleGenerateImage = useCallback(async () => {
    if (!processedReferenceData) {
        setError("Please upload a reference and subject photo and wait for analysis to complete.");
        return;
    }
    if (subjectImages.length === 0) {
      setError("Please upload at least one subject photo.");
      return;
    }
    
    setError(null);
    setIsLoading(true);
    setGeneratedImage(null);

    try {
        const url = await generateImageWithAI(prompt, [processedReferenceData.part], subjectImages, aspectRatio, avoidPrompt, '');
        setGeneratedImage({ id: crypto.randomUUID(), url, sourceReferenceFile: processedReferenceData.file });
    } catch (e) {
        setError(`Failed to generate image. The model may have refused the request.`);
        console.error(e);
    }

    setEditPrompt('');
    setIsLoading(false);
  }, [prompt, processedReferenceData, subjectImages, aspectRatio, avoidPrompt]);
  
  const handleRegenerateImage = useCallback(async () => {
    if (!generatedImage || !processedReferenceData) return;

    setError(null);
    setIsLoading(true);

    try {
        const newUrl = await generateImageWithAI(prompt, [processedReferenceData.part], subjectImages, aspectRatio, avoidPrompt, editPrompt);
        setGeneratedImage(prev => prev ? { ...prev, url: newUrl } : null);
        setEditPrompt('');
    } catch (e) {
        setError("Failed to regenerate image.");
        console.error(e);
    } finally {
        setIsLoading(false);
    }

  }, [generatedImage, processedReferenceData, prompt, subjectImages, aspectRatio, avoidPrompt, editPrompt]);

  const handleSaveImage = useCallback((imageUrl: string) => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    const mimeType = imageUrl.split(';')[0].split(':')[1];
    const extension = mimeType.split('/')[1] || 'png';
    link.download = `generated-image-4k-${Date.now()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const anyLoading = isLoading || isEnhancing || isEnhancingAvoid || isEnhancingEdit || isAnalyzingReference;
  
  const getGenerateButtonText = () => {
      if (isLoading) return 'Working...';
      if (generatedImage) return 'Regenerate / Apply Edit';
      return 'Generate Image';
  };
  
  const mainAction = generatedImage ? handleRegenerateImage : handleGenerateImage;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <div className="container mx-auto p-4 pb-28 lg:p-8">
          <header className="py-4 mb-4 lg:mb-8 text-center">
              <h1 className="text-2xl lg:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                  Contextual Image Studio
              </h1>
          </header>
          <main className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 lg:h-[calc(100vh-220px)]">
            {/* Left Column: Inputs */}
            <div className="flex flex-col gap-6 lg:overflow-y-auto lg:pr-2">
              <ImageUploader
                id="reference-photos"
                title="Reference Photo (Scene/Location)"
                files={referenceImages}
                onFilesChange={handleReferenceFilesChange}
                isLoading={isAnalyzingReference && !processedReferenceData}
                multiple={false}
              />
              <ImageUploader
                id="subject-photos"
                title="Subject Photos (People/Objects to Add)"
                files={subjectImages}
                onFilesChange={handleSubjectFilesChange}
                isLoading={isAnalyzingReference && !processedReferenceData}
                required
              />
              
              <div className="flex flex-col gap-2">
                <label htmlFor="prompt" className="text-lg font-semibold text-gray-300">
                  Your Creative Prompt
                </label>
                <div className="relative">
                  <textarea
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Upload a reference and subject photo to auto-generate a prompt. You can also add your own requests here before the analysis begins."
                    className="w-full h-36 p-3 bg-gray-800 border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors resize-none"
                  />
                  <button
                    onClick={handleEnhancePrompt}
                    disabled={anyLoading}
                    className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md transition-all duration-200"
                  >
                    {isEnhancing ? <Spinner small /> : <SparklesIcon className="w-4 h-4" />}
                    Enhance
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="avoid-prompt" className="text-lg font-semibold text-gray-300">
                  Things to Avoid (Negative Prompt)
                </label>
                <div className="relative">
                  <textarea
                    id="avoid-prompt"
                    value={avoidPrompt}
                    onChange={(e) => setAvoidPrompt(e.target.value)}
                    placeholder="e.g., Don't change my face, no jewelry, blurry background..."
                    className="w-full h-28 p-3 bg-gray-800 border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-colors resize-none"
                  />
                  <button
                    onClick={handleEnhanceAvoidPrompt}
                    disabled={anyLoading}
                    className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-gray-600 hover:bg-gray-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md transition-all duration-200"
                  >
                    {isEnhancingAvoid ? <Spinner small /> : <SparklesIcon className="w-4 h-4" />}
                    Enhance
                  </button>
                </div>
              </div>

              <AspectRatioSelector
                selected={aspectRatio}
                onSelect={setAspectRatio}
              />
            </div>

            {/* Right Column: Output */}
            <div className="flex flex-col justify-start items-center bg-gray-800/50 border-2 border-dashed border-gray-700 rounded-xl p-4 min-h-[50vh] lg:min-h-0 lg:overflow-y-auto">
              {isLoading ? (
                <div className="text-center my-auto">
                  <Spinner />
                  <p className="mt-4 text-gray-400 animate-pulse">Crafting your masterpiece...</p>
                </div>
              ) : generatedImage ? (
                 <div className="w-full">
                    <div className="relative group border-2 border-transparent rounded-lg">
                        <img src={generatedImage.url} alt="Generated result" className="w-full object-contain rounded-md shadow-lg" />
                        <div className="absolute bottom-2 left-2 right-2 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <button onClick={() => handleSaveImage(generatedImage.url)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-gray-900/70 text-white rounded-md backdrop-blur-sm hover:bg-gray-800">
                                <DownloadIcon className="w-4 h-4" /> Save 4K
                            </button>
                        </div>
                    </div>

                    <div className="w-full mt-6 flex flex-col gap-2">
                        <label htmlFor="edit-prompt" className="text-lg font-semibold text-gray-300">
                           Make a Change
                        </label>
                        <div className="relative">
                        <textarea
                            id="edit-prompt"
                            value={editPrompt}
                            onChange={(e) => setEditPrompt(e.target.value)}
                            placeholder={"e.g., Change the shirt to a jacket..."}
                            className="w-full h-28 p-3 bg-gray-900 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors resize-none"
                        />
                        <button
                            onClick={handleEnhanceEditPrompt}
                            disabled={anyLoading}
                            className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md transition-all duration-200"
                        >
                            {isEnhancingEdit ? <Spinner small /> : <SparklesIcon className="w-4 h-4" />}
                            Enhance
                        </button>
                        </div>
                    </div>
                 </div>
              ) : (
                <div className="text-center text-gray-500 my-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <p className="mt-2">Your generated image will appear here</p>
                </div>
              )}
              {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
            </div>
          </main>
          
          {/* Mobile Action Bar */}
          <footer className="fixed bottom-0 left-0 right-0 p-4 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700 lg:hidden">
              <button
                onClick={mainAction}
                disabled={anyLoading}
                className="w-full py-3 px-4 text-lg font-bold bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 rounded-lg shadow-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
              >
                {getGenerateButtonText()}
              </button>
          </footer>

          {/* Desktop Action Button */}
          <div className="hidden lg:flex justify-center mt-8">
              <button
                onClick={mainAction}
                disabled={anyLoading}
                className="py-4 px-12 text-xl font-bold bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 rounded-lg shadow-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
              >
                {getGenerateButtonText()}
              </button>
          </div>
      </div>
    </div>
  );
}

export default App;