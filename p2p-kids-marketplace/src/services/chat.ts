/**
 * File: p2p-kids-marketplace/src/services/chat.ts
 * MODULE-07 MSG-001: Chat Service with Supabase Realtime
 * 
 * Implements:
 * - sendMessage: Send text message to trade chat
 * - getMessages: Fetch all messages for a trade (excluding deleted)
 * - subscribeToMessages: Subscribe to real-time message updates
 * - unsubscribeFromMessages: Clean up realtime subscription
 */

import { supabase } from '../config/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Message {
  id: string;
  trade_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image';
  image_url?: string;
  created_at: string;
}

export interface SendMessageInput {
  tradeId: string;
  senderId: string;
  content: string;
}

export interface SendMessageResult {
  success: boolean;
  message?: Message;
  error?: string;
}

/**
 * Send a text message to a trade chat
 * 
 * @param input - Message input (tradeId, senderId, content)
 * @returns Result with success flag and message or error
 */
export async function sendMessage(
  input: SendMessageInput
): Promise<SendMessageResult> {
  const { tradeId, senderId, content } = input;

  // Validate input
  if (!tradeId || !senderId || !content?.trim()) {
    return {
      success: false,
      error: 'Missing required fields: tradeId, senderId, or content',
    };
  }

  const trimmedContent = content.trim();
  console.log(`[chat.sendMessage] Validating message with ${trimmedContent.length} chars`);
  
  if (trimmedContent.length > 2000) {
    console.error(`[chat.sendMessage] ⚠️ REJECTED: Message exceeds 2000 chars (${trimmedContent.length} chars)`);
    return {
      success: false,
      error: `Message content exceeds 2000 characters (current: ${trimmedContent.length})`,
    };
  }

  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        trade_id: tradeId,
        sender_id: senderId,
        content: content.trim(),
        message_type: 'text',
      })
      .select('*')
      .single();

    if (error) {
      console.error('[chat.sendMessage] Database error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send message',
      };
    }

    return {
      success: true,
      message: data,
    };
  } catch (error: any) {
    console.error('[chat.sendMessage] Unexpected error:', error);
    return {
      success: false,
      error: error.message || 'Unexpected error sending message',
    };
  }
}

/**
 * Fetch all messages for a trade (excluding deleted)
 * 
 * @param tradeId - Trade ID to fetch messages for
 * @returns Array of messages sorted by created_at (oldest first)
 */
export async function getMessages(tradeId: string): Promise<Message[]> {
  if (!tradeId) {
    console.error('[chat.getMessages] Missing tradeId');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('trade_id', tradeId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[chat.getMessages] Database error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[chat.getMessages] Unexpected error:', error);
    return [];
  }
}

/**
 * Subscribe to real-time message updates for a trade
 * 
 * @param tradeId - Trade ID to subscribe to
 * @param onMessage - Callback when new message arrives
 * @returns RealtimeChannel for cleanup
 */
export function subscribeToMessages(
  tradeId: string,
  onMessage: (message: Message) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`trade:${tradeId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `trade_id=eq.${tradeId}`,
      },
      async (payload) => {
        console.log('[chat.subscribeToMessages] New message received:', payload.new.id);
        onMessage(payload.new as Message);
      }
    )
    .subscribe((status) => {
      console.log('[chat.subscribeToMessages] Subscription status:', status);
    });

  return channel;
}

/**
 * Unsubscribe from real-time messages
 * 
 * @param channel - RealtimeChannel to unsubscribe
 */
export async function unsubscribeFromMessages(
  channel: RealtimeChannel
): Promise<void> {
  if (channel) {
    await channel.unsubscribe();
    console.log('[chat.unsubscribeFromMessages] Unsubscribed');
  }
}
