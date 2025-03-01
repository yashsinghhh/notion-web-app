// app/api/notion/[id]/route.ts
import { Client } from '@notionhq/client';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_API_KEY
});

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

    // Call Notion API to archive the page (Notion doesn't have a true delete operation)
    await notion.pages.update({
      page_id: pageId,
      archived: true, // This is how you "delete" a page in Notion
    });

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