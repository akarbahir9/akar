
import React from 'react';
import type { AspectRatio } from '../types';

interface AspectRatioSelectorProps {
  selected: AspectRatio;
  onSelect: (size: AspectRatio) => void;
}

const sizes: { value: AspectRatio; label: string }[] = [
  { value: '1:1', label: 'Square' },
  { value: '16:9', label: 'Landscape' },
  { value: '9:16', label: 'Portrait' },
  { value: '4:3', label: 'Standard' },
  { value: '3:2', label: 'Photo' },
];

export const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({ selected, onSelect }) => {
  return (
    <div className="flex flex-col gap-2">
       <label className="text-lg font-semibold text-gray-300">
        Output Size
      </label>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {sizes.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onSelect(value)}
            className={`px-3 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 ${
              selected === value
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <p>{label}</p>
            <p className="text-xs text-gray-400">{value}</p>
          </button>
        ))}
      </div>
    </div>
  );
};
