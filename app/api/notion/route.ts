// app/api/notion/route.ts
import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';
import { 
  BlockObjectResponse, 
  PartialBlockObjectResponse,
  RichTextItemResponse
} from '@notionhq/client/build/src/api-endpoints';

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

// Helper to safely access rich text content from blocks
function getRichTextContent(richTextArray: RichTextItemResponse[] | undefined): string {
  if (!richTextArray || !Array.isArray(richTextArray)) return '';
  return richTextArray.map(text => text.plain_text || '').join('');
}

// Recursive function to extract text from toggle blocks
async function extractToggleContent(block: BlockObjectResponse): Promise<any> {
  // Type check to ensure we're dealing with a toggle block
  if (block.type !== 'toggle' || !('toggle' in block)) {
    return null;
  }
  
  // Get the toggle header text
  const headerText = getRichTextContent(block.toggle.rich_text);
  
  // Initialize children array
  const children = [];
  
  // Fetch child blocks if they exist
  if (block.has_children) {
    try {
      const childBlocksResponse = await notion.blocks.children.list({
        block_id: block.id,
        page_size: 100
      });
      
      // Process each child block
      for (const childBlock of childBlocksResponse.results as BlockObjectResponse[]) {
        let childContent;
        
        // Process the child based on its type
        switch(childBlock.type) {
          case 'paragraph':
            if ('paragraph' in childBlock) {
              childContent = {
                type: 'paragraph',
                content: getRichTextContent(childBlock.paragraph.rich_text)
              };
            }
            break;
          case 'heading_1':
            if ('heading_1' in childBlock) {
              childContent = {
                type: 'heading_1',
                content: getRichTextContent(childBlock.heading_1.rich_text)
              };
            }
            break;
          case 'heading_2':
            if ('heading_2' in childBlock) {
              childContent = {
                type: 'heading_2',
                content: getRichTextContent(childBlock.heading_2.rich_text)
              };
            }
            break;
          case 'heading_3':
            if ('heading_3' in childBlock) {
              childContent = {
                type: 'heading_3',
                content: getRichTextContent(childBlock.heading_3.rich_text)
              };
            }
            break;
          case 'bulleted_list_item':
            if ('bulleted_list_item' in childBlock) {
              childContent = {
                type: 'bulleted_list_item',
                content: getRichTextContent(childBlock.bulleted_list_item.rich_text)
              };
            }
            break;
          case 'numbered_list_item':
            if ('numbered_list_item' in childBlock) {
              childContent = {
                type: 'numbered_list_item',
                content: getRichTextContent(childBlock.numbered_list_item.rich_text)
              };
            }
            break;
          case 'toggle':
            // Recursively process nested toggles
            childContent = await extractToggleContent(childBlock);
            break;
        }
        
        if (childContent && (typeof childContent === 'object' ? 
            (childContent.content && childContent.content.trim() !== '') : 
            childContent.trim() !== '')) {
          children.push(childContent);
        }
      }
    } catch (error) {
      console.error(`Error fetching toggle children for block ${block.id}:`, error);
    }
  }
  
  // Return structured toggle data
  return {
    type: 'toggle',
    content: headerText,
    children: children
  };
}

// Helper function to extract content from different block types
async function extractBlockContent(block: BlockObjectResponse | PartialBlockObjectResponse): Promise<any> {
  // Handle partial blocks
  if (!('type' in block)) {
    return null;
  }
  
  switch(block.type) {
    case 'paragraph':
      if ('paragraph' in block) {
        return {
          type: 'paragraph',
          content: getRichTextContent(block.paragraph.rich_text)
        };
      }
      break;
    case 'heading_1':
      if ('heading_1' in block) {
        return {
          type: 'heading_1',
          content: getRichTextContent(block.heading_1.rich_text)
        };
      }
      break;
    case 'heading_2':
      if ('heading_2' in block) {
        return {
          type: 'heading_2',
          content: getRichTextContent(block.heading_2.rich_text)
        };
      }
      break;
    case 'heading_3':
      if ('heading_3' in block) {
        return {
          type: 'heading_3',
          content: getRichTextContent(block.heading_3.rich_text)
        };
      }
      break;
    case 'bulleted_list_item':
      if ('bulleted_list_item' in block) {
        return {
          type: 'bulleted_list_item',
          content: getRichTextContent(block.bulleted_list_item.rich_text)
        };
      }
      break;
    case 'numbered_list_item':
      if ('numbered_list_item' in block) {
        return {
          type: 'numbered_list_item',
          content: getRichTextContent(block.numbered_list_item.rich_text)
        };
      }
      break;
    case 'toggle':
      if ('toggle' in block) {
        return await extractToggleContent(block as BlockObjectResponse);
      }
      break;
    default:
      // For unsupported block types, return a basic object
      return {
        type: block.type,
        content: 'Unsupported block type: ' + block.type
      };
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

        // Process blocks with async support
        const blockContentsPromises = blocksResponse.results
          .map(block => extractBlockContent(block as BlockObjectResponse));
        
        // Wait for all block processing to complete
        const blockContents = (await Promise.all(blockContentsPromises))
          .filter(content => content !== null && 
            (typeof content.content === 'string' ? 
              content.content.trim() !== '' : true));
        
        // Generate a simple fullText for search purposes
        // This is a flattened version of all text content
        const extractFullText = (blocks: any[]): string => {
          return blocks.map(block => {
            if (block.type === 'toggle' && block.children) {
              return block.content + '\n' + extractFullText(block.children);
            }
            return block.content;
          }).join('\n');
        };

        pageContent = {
          blocks: blockContents,
          fullText: extractFullText(blockContents)
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