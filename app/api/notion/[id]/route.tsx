// app/api/notion/[id]/route.tsx
import { Client } from '@notionhq/client';
import { NextRequest, NextResponse } from 'next/server';
import redisClient from '@/lib/redis';
import { 
  BlockObjectResponse, 
  PageObjectResponse,
  RichTextItemResponse
} from '@notionhq/client/build/src/api-endpoints';

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_API_KEY
});

// Cache expiration (1 hour)
const CACHE_EXPIRATION = 3600; // seconds

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
function extractRichTextContent(richTexts: RichTextItemResponse[]): string {
  return richTexts.map((text: RichTextItemResponse) => text.plain_text || '').join('').trim();
}

// Define a type for processed blocks
type ProcessedBlock = {
  type: string;
  content: string;
  children?: ProcessedBlock[];
};

// Batch fetch children for blocks
async function batchFetchBlockChildren(
  blocks: BlockObjectResponse[], 
  maxDepth: number = 3
): Promise<Record<string, ProcessedBlock[]>> {
  // Filter blocks with children
  const blocksWithChildren = blocks.filter(block => block.has_children);
  
  // Limit batch size to prevent overwhelming the API
  const BATCH_SIZE = 10;
  const childrenMap: Record<string, ProcessedBlock[]> = {};

  // Process in batches
  for (let i = 0; i < blocksWithChildren.length; i += BATCH_SIZE) {
    const batchBlocks = blocksWithChildren.slice(i, i + BATCH_SIZE);
    
    // Fetch children for this batch in parallel
    const batchChildrenPromises = batchBlocks.map(async (block) => {
      try {
        const childBlocksResponse = await notion.blocks.children.list({
          block_id: block.id,
          page_size: 100,
        });

        // Process these child blocks
        return {
          parentId: block.id,
          children: await processBlocksFromResponse(childBlocksResponse.results as BlockObjectResponse[], maxDepth - 1)
        };
      } catch (error) {
        console.error(`Error fetching children for block ${block.id}:`, error);
        return null;
      }
    });

    // Wait for batch to complete
    const batchChildren = await Promise.all(batchChildrenPromises);
    
    // Populate children map
    batchChildren.forEach(result => {
      if (result && result.children.length > 0) {
        childrenMap[result.parentId] = result.children;
      }
    });
  }

  return childrenMap;
}

// Process blocks from a response
async function processBlocksFromResponse(
  blocks: BlockObjectResponse[], 
  maxDepth: number = 3,
  childrenMap?: Record<string, ProcessedBlock[]>
): Promise<ProcessedBlock[]> {
  const processedBlocks: ProcessedBlock[] = [];
  
  for (const block of blocks) {
    let processedBlock: ProcessedBlock | null = null;
    
    switch(block.type) {
      case 'paragraph':
      case 'heading_1':
      case 'heading_2':
      case 'heading_3':
      case 'bulleted_list_item':
      case 'toggle': {
        let content = '';
        switch(block.type) {
          case 'paragraph':
            content = extractRichTextContent(block.paragraph.rich_text);
            break;
          case 'heading_1':
            content = extractRichTextContent(block.heading_1.rich_text);
            break;
          case 'heading_2':
            content = extractRichTextContent(block.heading_2.rich_text);
            break;
          case 'heading_3':
            content = extractRichTextContent(block.heading_3.rich_text);
            break;
          case 'bulleted_list_item':
            content = extractRichTextContent(block.bulleted_list_item.rich_text);
            break;
          case 'toggle':
            content = extractRichTextContent(block.toggle.rich_text);
            break;
        }

        // Only process if content exists and we haven't exceeded max depth
        if (content && maxDepth > 0) {
          processedBlock = { 
            type: block.type, 
            content 
          };

          // Add children if available
          if (block.has_children && childrenMap && childrenMap[block.id]) {
            processedBlock.children = childrenMap[block.id];
          }
        }
        break;
      }
    }
    
    if (processedBlock) {
      processedBlocks.push(processedBlock);
    }
  }
  
  return processedBlocks;
}

// Main block processing function
async function processBlocks(pageId: string): Promise<ProcessedBlock[]> {
  try {
    // Fetch initial blocks
    const blocksResponse = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
    });

    // Batch fetch children for all blocks with children
    const childrenMap = await batchFetchBlockChildren(
      blocksResponse.results as BlockObjectResponse[]
    );

    // Process blocks with batch-fetched children
    return await processBlocksFromResponse(
      blocksResponse.results as BlockObjectResponse[],
      3,
      childrenMap
    );
  } catch (error) {
    console.error(`Error processing blocks for ${pageId}:`, error);
    return [];
  }
}

// Generate a cache key for a specific page
function getPageCacheKey(pageId: string): string {
  return `notion_page:${pageId}`;
}

// Retrieve cached page
async function getCachedPage(pageId: string): Promise<any | null> {
  try {
    const cachedData = await redisClient.get(getPageCacheKey(pageId));
    return cachedData ? JSON.parse(cachedData) : null;
  } catch (error) {
    console.error('Redis cache retrieval error:', error);
    return null;
  }
}

// Cache a page
async function cachePage(pageId: string, pageData: any): Promise<void> {
  try {
    await redisClient.set(
      getPageCacheKey(pageId), 
      JSON.stringify(pageData), 
      'EX', 
      CACHE_EXPIRATION
    );
  } catch (error) {
    console.error('Redis cache setting error:', error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();

  try {
    const pageId = params.id;

    if (!pageId) {
      return NextResponse.json(
        { error: 'No page ID provided' },
        { status: 400 }
      );
    }

    // First, check Redis cache
    const cachedPage = await getCachedPage(pageId);
    if (cachedPage) {
      console.log('Returning cached Notion page');
      return NextResponse.json(cachedPage);
    }

    // Fetch page from Notion if not in cache
    const pageResponse = await notion.pages.retrieve({
      page_id: pageId
    }) as PageObjectResponse;

    // Extract properties dynamically
    const properties: Record<string, any> = {};
    Object.entries(pageResponse.properties).forEach(([key, prop]) => {
      properties[key] = extractPropertyValue(prop);
    });

    // Process all blocks starting at the page level
    const blockContents = await processBlocks(pageId);

    // Prepare full page data
    const pageData = {
      id: pageResponse.id,
      url: pageResponse.url,
      ...properties,
      blocks: blockContents
    };

    // Cache the page data
    await cachePage(pageId, pageData);

    const processingTime = Date.now() - startTime;
    console.log(`Page processed in ${processingTime}ms`);

    return NextResponse.json(pageData);
  } catch (error) {
    console.error('Error fetching Notion page:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Notion page', details: error },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pageId = params.id;

    if (!pageId) {
      return NextResponse.json(
        { error: 'No page ID provided' },
        { status: 400 }
      );
    }

    // Archive the page in Notion
    await notion.pages.update({
      page_id: pageId,
      archived: true,
    });

    // Remove the page from Redis cache
    try {
      await redisClient.del(getPageCacheKey(pageId));
    } catch (cacheError) {
      console.error('Error removing page from Redis cache:', cacheError);
    }

    return NextResponse.json(
      { success: true, message: 'Page successfully deleted' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting Notion page:', error);
    return NextResponse.json(
      { error: 'Failed to delete Notion page', details: error },
      { status: 500 }
    );
  }
}