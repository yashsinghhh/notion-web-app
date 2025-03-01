// app/api/notion/route.ts
import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_API_KEY
});

// Helper function to extract page title
function extractPageTitle(properties: Record<string, any>): string | null {
  // Try multiple property types that could represent the page title
  const possibleTitleKeys = ['Pages', 'Pages ', 'Name', 'Title'];
  
  for (const key of possibleTitleKeys) {
    const prop = properties[key];
    
    if (!prop) continue;

    // Handle different property types
    switch (prop.type) {
      case 'title':
        return prop.title[0]?.plain_text || null;
      case 'rich_text':
        return prop.rich_text[0]?.plain_text || null;
      case 'select':
        return prop.select?.name || null;
      case 'multi_select':
        return prop.multi_select?.[0]?.name || null;
      default:
        // If it's a direct string or value
        if (typeof prop === 'string') return prop;
    }
  }

  return null;
}

export async function GET() {
  try {
    // Replace with your actual Notion database ID
    const databaseId = process.env.NOTION_DATABASE_ID;

    if (!databaseId) {
      return NextResponse.json(
        { error: 'Notion Database ID is not configured' }, 
        { status: 400 }
      );
    }

    // Fetch database entries
    const response = await notion.databases.query({
      database_id: databaseId,
    });

    // Transform Notion response to a more readable JSON format
    const transformedResults = await Promise.all(response.results.map(async (page: any) => {
      // Extract properties
      const properties: Record<string, any> = {};

      Object.entries(page.properties).forEach(([key, prop]: [string, any]) => {
        switch(prop.type) {
          case 'title':
            properties[key] = prop.title[0]?.plain_text || null;
            break;
          case 'rich_text':
            properties[key] = prop.rich_text[0]?.plain_text || null;
            break;
          case 'number':
            properties[key] = prop.number;
            break;
          case 'select':
            properties[key] = prop.select?.name || null;
            break;
          case 'multi_select':
            properties[key] = prop.multi_select.map((item: any) => item.name);
            break;
          case 'date':
            properties[key] = prop.date?.start || null;
            break;
          case 'people':
            properties[key] = prop.people.map((person: any) => ({
              id: person.id,
              name: person.name,
              avatar_url: person.avatar_url
            }));
            break;
          default:
            properties[key] = prop[prop.type];
        }
      });

      // Extract page title
      const pageTitle = extractPageTitle(properties);

      // Fetch full page content
      let pageContent = null;
      try {
        const pageDetails = await notion.pages.retrieve({ 
          page_id: page.id 
        });

        // Retrieve page content blocks
        const blocksResponse = await notion.blocks.children.list({
          block_id: page.id,
          page_size: 100 // Adjust as needed
        });

        // Transform blocks to readable text
        const blockContents = blocksResponse.results.map((block: any) => {
          // Handle different block types
          switch(block.type) {
            case 'paragraph':
              return block.paragraph.rich_text.map((text: any) => text.plain_text).join('');
            case 'heading_1':
              return `# ${block.heading_1.rich_text.map((text: any) => text.plain_text).join('')}`;
            case 'heading_2':
              return `## ${block.heading_2.rich_text.map((text: any) => text.plain_text).join('')}`;
            case 'heading_3':
              return `### ${block.heading_3.rich_text.map((text: any) => text.plain_text).join('')}`;
            case 'bulleted_list_item':
              return `- ${block.bulleted_list_item.rich_text.map((text: any) => text.plain_text).join('')}`;
            case 'numbered_list_item':
              return `1. ${block.numbered_list_item.rich_text.map((text: any) => text.plain_text).join('')}`;
            default:
              return ''; // Ignore other block types or add more as needed
          }
        }).filter((content: string) => content.trim() !== '');

        pageContent = {
          blocks: blockContents,
          fullText: blockContents.join('\n')
        };
      } catch (contentError) {
        console.error(`Error fetching content for page ${page.id}:`, contentError);
      }

      return {
        id: page.id,
        url: page.url,
        pageTitle, // Use the extracted page title
        ...properties,
        content: pageContent
      };
    }));

    return NextResponse.json(transformedResults);
  } catch (error) {
    console.error('Error fetching Notion database:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Notion database', details: error }, 
      { status: 500 }
    );
  }
}