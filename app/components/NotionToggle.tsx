// app/components/NotionToggle.tsx
"use client";

import { useState } from 'react';

interface ToggleProps {
  header: string;
  children: React.ReactNode;
}

export default function NotionToggle({ header, children }: ToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="my-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center w-full text-left font-medium text-gray-800 hover:bg-gray-50 rounded p-2 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="mr-2 transition-transform duration-200" style={{ 
          transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)'
        }}>
          ▶
        </span>
        <span>{header}</span>
      </button>
      
      {isOpen && (
        <div className="pl-8 mt-2 border-l-2 border-gray-200">
          {children}
        </div>
      )}
    </div>
  );
}