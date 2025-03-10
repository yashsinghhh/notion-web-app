// app/components/NotionBlockRenderer.tsx
"use client";

import { Fragment, ReactNode } from 'react';
import NotionToggle from './NotionToggle';
import { v4 as uuidv4 } from 'uuid';

interface BlockProps {
  blocks: Array<{
    type: string;
    content: string;
    children?: any[];
  }>;
}

// Helper to check if a block is a numbered list item
const isNumberedListItem = (block: any) => block.type === "numbered_list_item";
const isBulletedListItem = (block: any) => block.type === "bulleted_list_item";

export default function NotionBlockRenderer({ blocks }: BlockProps) {
  const renderBlocks = () => {
    const result: ReactNode[] = [];
    let currentNumberedListItems: any[] = [];
    let currentBulletedListItems: any[] = [];
    
    // Helper function to render the current numbered list items
    const renderNumberedList = () => {
      if (currentNumberedListItems.length === 0) return null;
      return (
        <ol key={`numbered-list-${uuidv4()}`} className="list-decimal ml-6 space-y-2">
          {currentNumberedListItems.map((item, idx) => (
            <li 
              key={`numbered-list-item-${uuidv4()}`} 
              className="text-gray-700 pl-1"
            >
              {item.content}
              {item.children && item.children.length > 0 && (
                <div className="mt-2">
                  <NotionBlockRenderer blocks={item.children} />
                </div>
              )}
            </li>
          ))}
        </ol>
      );
    };
    
    // Helper function to render the current bulleted list items
    const renderBulletedList = () => {
      if (currentBulletedListItems.length === 0) return null;
      return (
        <ul key={`bulleted-list-${uuidv4()}`} className="list-disc ml-6 space-y-2">
          {currentBulletedListItems.map((item, idx) => (
            <li 
              key={`bulleted-list-item-${uuidv4()}`} 
              className="text-gray-700 pl-1"
            >
              {item.content}
              {item.children && item.children.length > 0 && (
                <div className="mt-2">
                  <NotionBlockRenderer blocks={item.children} />
                </div>
              )}
            </li>
          ))}
        </ul>
      );
    };
    
    // Process all blocks
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      
      // If it's a numbered list item, collect it
      if (isNumberedListItem(block)) {
        // If we were collecting bulleted list items, render the list
        if (currentBulletedListItems.length > 0) {
          result.push(renderBulletedList());
          currentBulletedListItems = [];
        }
        
        currentNumberedListItems.push(block);
      } 
      // If it's a bulleted list item, collect it
      else if (isBulletedListItem(block)) {
        // If we were collecting numbered list items, render the list
        if (currentNumberedListItems.length > 0) {
          result.push(renderNumberedList());
          currentNumberedListItems = [];
        }
        
        currentBulletedListItems.push(block);
      } 
      // If it's not a list item
      else {
        // Render any collected list items
        if (currentNumberedListItems.length > 0) {
          result.push(renderNumberedList());
          currentNumberedListItems = [];
        }
        
        if (currentBulletedListItems.length > 0) {
          result.push(renderBulletedList());
          currentBulletedListItems = [];
        }
        
        // Render the current non-list block
        result.push(renderBlock(block, i));
      }
    }
    
    // Don't forget to render any remaining list items
    if (currentNumberedListItems.length > 0) {
      result.push(renderNumberedList());
    }
    
    if (currentBulletedListItems.length > 0) {
      result.push(renderBulletedList());
    }
    
    return result;
  };
  
  // Function to render a single block
  const renderBlock = (block: any, index: number) => {
    const key = `block-${block.type}-${uuidv4()}`;
    
    switch (block.type) {
      case "paragraph":
        return <p key={key} className="text-base leading-relaxed my-4">{block.content}</p>;
      case "heading_1":
        return <h1 key={key} className="text-3xl font-bold text-gray-900 mt-8 mb-4 border-b pb-2">{block.content}</h1>;
      case "heading_2":
        return <h2 key={key} className="text-2xl font-semibold text-gray-800 mt-6 mb-3">{block.content}</h2>;
      case "heading_3":
        return <h3 key={key} className="text-xl font-medium text-gray-700 mt-4 mb-2">{block.content}</h3>;
      case "toggle":
        return (
          <NotionToggle key={key} header={block.content}>
            {block.children && block.children.length > 0 && (
              <NotionBlockRenderer blocks={block.children} />
            )}
          </NotionToggle>
        );
      default:
        return <p key={key} className="text-base leading-relaxed">{block.content}</p>;
    }
  };
  
  return <Fragment>{renderBlocks()}</Fragment>;
}