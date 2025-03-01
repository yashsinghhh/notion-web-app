import { Client } from "@notionhq/client";
import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

// Define a more flexible interface for page details
interface NotionPageDetails {
  id: string;
  url: string;
  blocks: Array<{
    type: string;
    content: string;
  }>;
  [key: string]: any; // Allow additional dynamic properties
}

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// Helper function to extract property value
function extractPropertyValue(property: any): any {
  switch (property.type) {
    case "title":
      return property.title[0]?.plain_text || null;
    case "rich_text":
      return property.rich_text[0]?.plain_text || null;
    case "people":
      return property.people.map((person: any) => ({
        id: person.id,
        name: person.name,
        avatar_url: person.avatar_url,
      }));
    case "date":
      return property.date?.start || null;
    case "select":
      return property.select?.name || null;
    default:
      return property[property.type];
  }
}

// Extract content from rich text blocks
function extractRichTextContent(richTexts: any[]): string {
  return richTexts.map((text: any) => text.plain_text || '').join('').trim();
}

// Fetch Notion Page Details (Helper Function)
async function fetchNotionPage(id: string): Promise<NotionPageDetails | null> {
  try {
    // Type assertion to ensure we're working with a full page response
    const pageResponse = await notion.pages.retrieve({ 
      page_id: id 
    }) as PageObjectResponse;

    // Retrieve page content blocks
    const blocksResponse = await notion.blocks.children.list({
      block_id: id,
      page_size: 100, // Adjust as needed
    });

    // Extract properties dynamically
    const properties: Record<string, any> = {};
    Object.entries(pageResponse.properties).forEach(([key, prop]) => {
      properties[key] = extractPropertyValue(prop);
    });

    // Transform blocks to detailed content with strict type checking
    const blockContents = blocksResponse.results
      .map((block: any) => {
        switch (block.type) {
          case "paragraph": {
            const content = extractRichTextContent(block.paragraph.rich_text);
            return content ? { type: "paragraph", content } : null;
          }
          case "heading_1": {
            const content = extractRichTextContent(block.heading_1.rich_text);
            return content ? { type: "heading_1", content } : null;
          }
          case "heading_2": {
            const content = extractRichTextContent(block.heading_2.rich_text);
            return content ? { type: "heading_2", content } : null;
          }
          case "heading_3": {
            const content = extractRichTextContent(block.heading_3.rich_text);
            return content ? { type: "heading_3", content } : null;
          }
          case "bulleted_list_item": {
            const content = extractRichTextContent(block.bulleted_list_item.rich_text);
            return content ? { type: "bulleted_list_item", content } : null;
          }
          case "numbered_list_item": {
            const content = extractRichTextContent(block.numbered_list_item.rich_text);
            return content ? { type: "numbered_list_item", content } : null;
          }
          default:
            return null;
        }
      })
      // Type guard to ensure only non-null blocks with content are included
      .filter((block): block is { type: string; content: string } => 
        block !== null && block.content.trim() !== ""
      );

    return {
      id: pageResponse.id,
      url: pageResponse.url,
      ...properties,
      blocks: blockContents,
    };
  } catch (error) {
    console.error("Error fetching Notion page:", error);
    return null;
  }
}

export default async function NotionPageDetail({ params }: { params: { id: string } }) {
  // Validate params
  const pageId = params.id;
  
  if (!pageId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-600 text-xl">No page ID provided</p>
      </div>
    );
  }

  // Fetch page details
  const pageDetails = await fetchNotionPage(pageId);

  if (!pageDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-600 text-xl">Failed to load page content</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* User button and back navigation */}
      <div className="absolute top-4 right-4 flex items-center space-x-4">
        <Link href="/" className="text-blue-600 hover:text-blue-800 hover:underline">
          Back to Pages
        </Link>
        <UserButton afterSignOutUrl="/sign-in" />
      </div>

      <main className="container mx-auto px-4 py-16 max-w-3xl">
        {/* Page Header */}
        <header className="mb-12">
          {/* Author Info */}
          {pageDetails.people && pageDetails.people.length > 0 && (
            <div className="flex items-center mb-4">
              {pageDetails.people[0].avatar_url && (
                <Image
                  src={pageDetails.people[0].avatar_url}
                  alt={pageDetails.people[0].name}
                  width={48}
                  height={48}
                  className="rounded-full mr-4 object-cover"
                  style={{
                    aspectRatio: "1/1",
                    objectFit: "cover",
                  }}
                />
              )}
              <div>
                <h1 className="text-4xl font-bold text-gray-900">
                  {pageDetails["Pages "] || "Untitled Page"}
                </h1>
                <p className="text-gray-600">
                  Created by {pageDetails.people?.[0]?.name || "Unknown"}{" "}
                  {pageDetails.Date && ` on ${pageDetails.Date}`}
                </p>
              </div>
            </div>
          )}

          {/* Description */}
          {pageDetails.Description && (
            <p className="text-xl text-gray-800 mt-4 italic">
              {pageDetails.Description}
            </p>
          )}
        </header>

        {/* Page Content */}
        <article className="prose max-w-none">
          {pageDetails.blocks.map((block, index) => {
            switch (block.type) {
              case "heading_1":
                return <h1 key={index}>{block.content}</h1>;
              case "heading_2":
                return <h2 key={index}>{block.content}</h2>;
              case "heading_3":
                return <h3 key={index}>{block.content}</h3>;
              case "bulleted_list_item":
                return <li key={index} className="list-disc ml-6">{block.content}</li>;
              case "numbered_list_item":
                return <li key={index} className="list-decimal ml-6">{block.content}</li>;
              default:
                return <p key={index}>{block.content}</p>;
            }
          })}
        </article>

        {/* External Notion Link */}
        <div className="mt-8 text-center">
          <a 
            href={pageDetails.url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-blue-600 hover:text-blue-800 hover:underline"
          >
            View Original in Notion
          </a>
        </div>
      </main>
    </div>
  );
}

// Generate static params for better performance
export async function generateStaticParams() {
  try {
    const notion = new Client({
      auth: process.env.NOTION_API_KEY,
    });

    const response = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID!,
    });

    return response.results.map((page: any) => ({
      id: page.id,
    }));
  } catch (error) {
    console.error("Error generating static params:", error);
    return [];
  }
}