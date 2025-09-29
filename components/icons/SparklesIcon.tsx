
import React from 'react';

export const SparklesIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 3L9.25 8.75L3.5 11.5L9.25 14.25L12 20L14.75 14.25L20.5 11.5L14.75 8.75L12 3Z" />
    <path d="M4 4L5 6" />
    <path d="M19 19L20 21" />
    <path d="M20 4L19 6" />
    <path d="M4 20L5 18" />
    <path d="M12 12L12 12" />
  </svg>
);
