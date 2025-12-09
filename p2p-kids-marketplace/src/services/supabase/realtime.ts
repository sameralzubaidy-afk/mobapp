import { supabase } from './client';

export const subscribeToMessages = (tradeId: string, callback: (payload: any) => void) => {
  const channel = supabase
    .channel(`messages:trade_id=eq.${tradeId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `trade_id=eq.${tradeId}` },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();

  return channel;
};

export const unsubscribe = async (channel: any) => {
  await supabase.removeChannel(channel);
};
