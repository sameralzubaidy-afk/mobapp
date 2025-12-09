import { supabase } from './client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export const subscribeToMessages = (
  tradeId: string,
  callback: (payload: any) => void
): RealtimeChannel => {
  const channel = supabase.channel(`messages:trade:${tradeId}`);
  channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `trade_id=eq.${tradeId}` }, (payload) => {
    callback(payload);
  });
  channel.subscribe();
  return channel as RealtimeChannel;
};

export const subscribeToItem = (itemId: string, callback: (payload: any) => void): RealtimeChannel => {
  const channel = supabase.channel(`items:${itemId}`);
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `id=eq.${itemId}` }, (payload) => {
    callback(payload);
  });
  channel.subscribe();
  return channel as RealtimeChannel;
};

export const unsubscribe = async (channel: RealtimeChannel): Promise<void> => {
  await supabase.removeChannel(channel);
};

export const unsubscribeAll = async (): Promise<void> => {
  await supabase.removeAllChannels();
};
