// app/components/NotionBlockRenderer.tsx
"use client";

import NotionToggle from './NotionToggle';

interface BlockProps {
  block: {
    type: string;
    content: string;
    children?: any[];
  };
}

export default function NotionBlockRenderer({ block }: BlockProps) {
  // Render based on block type
  switch (block.type) {
    case "paragraph":
      return <p className="text-base leading-relaxed my-4">{block.content}</p>;
    case "heading_1":
      return <h1 className="text-3xl font-bold text-gray-900 mt-8 mb-4 border-b pb-2">{block.content}</h1>;
    case "heading_2":
      return <h2 className="text-2xl font-semibold text-gray-800 mt-6 mb-3">{block.content}</h2>;
    case "heading_3":
      return <h3 className="text-xl font-medium text-gray-700 mt-4 mb-2">{block.content}</h3>;
    case "bulleted_list_item":
      return <li className="list-disc ml-6 text-gray-700">{block.content}</li>;
    case "numbered_list_item":
      return <li className="list-decimal ml-6 text-gray-700">{block.content}</li>;
    case "toggle":
      return (
        <NotionToggle header={block.content}>
          {block.children && block.children.map((childBlock, idx) => (
            <NotionBlockRenderer key={idx} block={childBlock} />
          ))}
        </NotionToggle>
      );
    default:
      return <p className="text-base leading-relaxed">{block.content}</p>;
  }
}