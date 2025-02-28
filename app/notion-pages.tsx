"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface NotionPage {
  id: string;
  url: string;
  Description: string;
  author: Array<{
    id: string;
    name: string;
    avatar_url: string;
  }>;
  Date: string;
  'Pages '?: string;
  content?: {
    blocks: string[];
    fullText: string;
  };
}

export default function NotionPages() {
  const [pages, setPages] = useState<NotionPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNotionPages() {
      try {
        const response = await fetch('/api/notion');
        if (!response.ok) {
          throw new Error('Failed to fetch Notion pages');
        }
        const data = await response.json();
        setPages(data);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setIsLoading(false);
      }
    }

    fetchNotionPages();
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-700">
        Loading pages...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 font-semibold">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-black">Notion Pages</h1>
      <div className="space-y-6">
        {pages.map((page) => (
          <div 
            key={page.id} 
            className="bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow border border-gray-200"
          >
            {/* Page Title and Author */}
            <div className="flex items-center mb-4">
              {/* Author Avatar */}
              {page.author && page.author.length > 0 && (
                <div className="mr-4">
                  <Image 
                    src={page.author[0].avatar_url} 
                    alt={page.author[0].name} 
                    width={48}  // Increased size
                    height={48} 
                    className="rounded-full object-cover"  // Ensures round shape
                    style={{ 
                      aspectRatio: '1/1',  // Force square aspect ratio
                      objectFit: 'cover'   // Cover the entire area
                    }}
                  />
                </div>
              )}
              
              {/* Page Title */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {page['Pages '] || 'Untitled Page'}
                </h2>
                <p className="text-gray-600 text-sm">
                  Created by {page.author?.[0]?.name || 'Unknown'} on {page.Date}
                </p>
              </div>
            </div>

            {/* Description */}
            {page.Description && (
              <p className="text-gray-800 mb-4 font-medium">
                {page.Description}
              </p>
            )}

            {/* Page Content */}
            {page.content && (
              <div className="prose max-w-none text-gray-700">
                {page.content.blocks.map((block, index) => (
                  <p key={index} className="mb-2">{block}</p>
                ))}
              </div>
            )}

            {/* Link to Notion Page */}
            <a 
              href={page.url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-600 hover:text-blue-800 hover:underline mt-4 inline-block font-semibold"
            >
              View in Notion
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}