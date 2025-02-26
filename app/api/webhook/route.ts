// app/api/webhook/route.ts
import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    // Get the headers - await the headers() call
    const headersList = await headers();
    const svix_id = headersList.get("svix-id");
    const svix_timestamp = headersList.get("svix-timestamp");
    const svix_signature = headersList.get("svix-signature");

    console.log('Headers received:', { svix_id, svix_timestamp, svix_signature });

    if (!svix_id || !svix_timestamp || !svix_signature) {
      console.error('Missing headers:', { svix_id, svix_timestamp, svix_signature });
      return new Response('Error occurred -- no svix headers', {
        status: 400
      });
    }

    // Get the body
    const payload = await req.json();
    const body = JSON.stringify(payload);

    const wh = new Webhook(process.env.WEBHOOK_SECRET || '');
    let evt: WebhookEvent;

    try {
      evt = wh.verify(body, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      }) as WebhookEvent;
    } catch (err) {
      console.error('Error verifying webhook:', err);
      return new Response('Error occurred', {
        status: 400
      });
    }

    const eventType = evt.type;
    console.log('Processing event type:', eventType);

    try {
      switch (eventType) {
        case 'user.created': {
          const { id, email_addresses, username, first_name, last_name, image_url } = evt.data;
          
          // First check if user exists
          const { data: existingUser } = await supabase
            .from('users')
            .select()
            .eq('clerk_id', id)
            .single();

          if (existingUser) {
            // Update existing user
            await supabase
              .from('users')
              .update({
                email: email_addresses[0]?.email_address,
                username: username || null,
                first_name: first_name || null,
                last_name: last_name || null,
                image_url: image_url || null,
                updated_at: new Date().toISOString()
              })
              .eq('clerk_id', id);
          } else {
            // Create new user
            await supabase
              .from('users')
              .insert({
                clerk_id: id,
                email: email_addresses[0]?.email_address,
                username: username || null,
                first_name: first_name || null,
                last_name: last_name || null,
                image_url: image_url || null,
              });
          }
          console.log('User processed successfully');
          break;
        }

        // Other cases remain the same...
      }

      return new Response('Webhook processed successfully', { status: 200 });
    } catch (error) {
      console.error('Database operation failed:', error);
      return new Response('Webhook processing failed', { status: 500 });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}