import React, { useState, useRef, useEffect } from 'react';
import type { AuthUser } from '../types';
import { signInWithGoogle, signOutUser } from '../services/firebase';
import { GoogleIcon } from './icons/GoogleIcon';

interface HeaderProps {
  user: AuthUser | null;
}

export const Header: React.FC<HeaderProps> = ({ user }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwitchAccount = () => {
    signInWithGoogle().catch(error => console.error("Account switch error:", error));
    setIsDropdownOpen(false);
  };

  const handleSignOut = () => {
    signOutUser().catch(error => console.error("Sign out error:", error));
    setIsDropdownOpen(false);
  };

  return (
    <header className="sticky top-0 z-20 bg-gray-900/80 backdrop-blur-sm border-b border-gray-700">
      <div className="container mx-auto px-4 lg:px-8 flex justify-between items-center h-16">
        <div className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
          Contextual Image Studio
        </div>
        <div>
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center gap-3 rounded-full hover:bg-gray-800 p-1 transition-colors">
                <span className="text-sm font-medium text-gray-300 hidden sm:block">{user.displayName}</span>
                <img
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=random`}
                  alt="User profile"
                  className="w-10 h-10 rounded-full border-2 border-gray-600"
                />
              </button>
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-md shadow-lg py-1">
                  <div className="px-4 py-2 border-b border-gray-700">
                    <p className="text-sm font-semibold text-gray-200 truncate">{user.displayName}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={handleSwitchAccount}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    Switch Account
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => signInWithGoogle().catch(error => console.error("Sign in error:", error))}
              className="flex items-center gap-2 px-4 py-2 font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors"
            >
              <GoogleIcon className="w-5 h-5" />
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
