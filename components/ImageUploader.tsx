import React, { useCallback, useState } from 'react';
import { UploadIcon } from './icons/UploadIcon';
import { TrashIcon } from './icons/TrashIcon';
import { Spinner } from './Spinner';

interface ImageUploaderProps {
  id: string;
  title: string;
  files: File[];
  onFilesChange: (files: File[]) => void;
  required?: boolean;
  isLoading?: boolean;
  multiple?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ id, title, files, onFilesChange, required = false, isLoading = false, multiple = true }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (newFiles && newFiles.length > 0) {
      if (multiple) {
        onFilesChange([...files, ...Array.from(newFiles)]);
      } else {
        onFilesChange([newFiles[0]]); // Always replace with the single selected file
      }
    }
  }, [files, onFilesChange, multiple]);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };
  
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-lg font-semibold text-gray-300">
        {title} {required && <span className="text-red-500">*</span>}
      </label>
      <div 
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-300 ${isDragging ? 'border-purple-500 bg-gray-800' : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'}`}
      >
        {isLoading && (
          <div className="absolute inset-0 bg-gray-900/80 flex flex-col justify-center items-center rounded-lg z-10">
            <Spinner />
            <p className="mt-2 text-purple-400">Analyzing...</p>
          </div>
        )}
        <UploadIcon className="w-8 h-8 text-gray-500 mb-2" />
        <p className="text-gray-400">Drag & drop files here, or click to select</p>
        <input
          id={id}
          type="file"
          multiple={multiple}
          accept="image/*"
          onChange={(e) => handleFiles(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      {files.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
          {files.map((file, index) => (
            <div key={index} className="relative group aspect-square">
              <img
                src={URL.createObjectURL(file)}
                alt={`preview ${index}`}
                className="w-full h-full object-cover rounded-md"
              />
              <button
                onClick={() => removeFile(index)}
                className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
