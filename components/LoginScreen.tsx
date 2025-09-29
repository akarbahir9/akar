import React from 'react';
import { signInWithGoogle } from '../services/firebase';
import { GoogleIcon } from './icons/GoogleIcon';

export const LoginScreen: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 lg:py-24">
      <h1 className="text-4xl lg:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
        Welcome to the Studio
      </h1>
      <p className="text-gray-400 mt-4 max-w-xl">
        Sign in to bring your creative visions to life with AI-powered image generation.
      </p>
      <button
        onClick={() => signInWithGoogle().catch(error => console.error("Sign in error:", error))}
        className="mt-8 flex items-center gap-3 px-6 py-3 font-bold text-lg bg-white text-gray-800 rounded-lg shadow-lg hover:bg-gray-200 transition-all transform hover:scale-105"
      >
        <GoogleIcon className="w-6 h-6" />
        Sign in with Google
      </button>
    </div>
  );
};
