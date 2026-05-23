// FILE: p2p-kids-marketplace/src/services/faqService.ts
// Fetches published FAQs and categories from Supabase.
// Falls back to hardcoded data if the DB request fails (offline / cold start).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';

export interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export interface FAQCategory {
  id: string;
  name: string;
  sort_order: number;
}

// ─── Fallback hardcoded data (mirrors DB seed) ────────────────

const FALLBACK_CATEGORIES: string[] = [
  'Getting Started',
  'Swap Points',
  'Trading',
  'Account',
  'Safety',
];

const FALLBACK_FAQS: FAQ[] = [
  {
    id: '1',
    category: 'Getting Started',
    question: 'How do I create my first listing?',
    answer: 'Tap the "Sell" button at the bottom of the screen, take photos of your item, and fill in the details.',
  },
  {
    id: '2',
    category: 'Getting Started',
    question: 'What is the Kids P2P Marketplace?',
    answer: 'A safe platform for kids and parents to buy, sell, and trade items locally.',
  },
  {
    id: '3',
    category: 'Swap Points',
    question: 'How do I earn Swap Points?',
    answer: 'You earn Swap Points when you sell items as a Kids Club+ subscriber. The amount depends on the item price and category multiplier.',
  },
  {
    id: '4',
    category: 'Swap Points',
    question: 'Can I use Swap Points for any purchase?',
    answer: 'Yes, but you can only use up to 50% of the item price in Swap Points. The platform fee must always be paid in cash.',
  },
  {
    id: '5',
    category: 'Trading',
    question: 'How do I complete a trade?',
    answer: 'Both buyer and seller must mark the trade as complete. The buyer confirms receipt, and the seller confirms delivery.',
  },
  {
    id: '6',
    category: 'Trading',
    question: 'What if I have an issue with a trade?',
    answer: 'You can open a dispute within 7 days of the trade. Our support team will help resolve the issue.',
  },
  {
    id: '7',
    category: 'Account',
    question: 'How do I verify my account?',
    answer: 'Go to Settings > Profile > Verify Identity and upload a government-issued ID photo.',
  },
  {
    id: '8',
    category: 'Account',
    question: 'Can I change my email address?',
    answer: 'Yes, go to Settings > Profile > Edit Profile to update your email. You\'ll need to verify the new email.',
  },
  {
    id: '9',
    category: 'Safety',
    question: 'How do I report an unsafe listing?',
    answer: 'Tap the three dots on any listing and select "Report". Choose the reason and provide details.',
  },
  {
    id: '10',
    category: 'Safety',
    question: 'Are my personal details kept private?',
    answer: 'Yes, we never share your email, phone, or address with other users. Communication happens through our in-app chat.',
  },
];

// ─── DB fetch ─────────────────────────────────────────────────

interface RawFaqItem {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  faq_categories: { id: string; name: string; sort_order: number } | null;
}

/**
 * Fetches published FAQ items joined with their category name.
 * Returns { faqs, categories } where categories is the "All" + unique sorted names.
 * On any error, returns fallback static data so the Help screen always works.
 */
export async function fetchPublishedFaqs(): Promise<{
  faqs: FAQ[];
  categories: string[];
}> {
  try {
    const { data, error } = await supabase
      .from('faq_items')
      .select('id, question, answer, sort_order, faq_categories(id, name, sort_order)')
      .eq('status', 'published')
      .order('sort_order', { ascending: true });

    if (error) {
      console.warn('[faqService] DB error, using fallback:', error.message);
      return { faqs: FALLBACK_FAQS, categories: ['All', ...FALLBACK_CATEGORIES] };
    }

    const rows = (data ?? []) as RawFaqItem[];

    const faqs: FAQ[] = rows.map((row) => ({
      id: row.id,
      category: row.faq_categories?.name ?? 'General',
      question: row.question,
      answer: row.answer,
    }));

    // Build sorted unique category list from the fetched data
    const catMap = new Map<string, number>();
    rows.forEach((row) => {
      if (row.faq_categories) {
        catMap.set(row.faq_categories.name, row.faq_categories.sort_order);
      }
    });
    const sortedCats = [...catMap.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([name]) => name);

    return { faqs, categories: ['All', ...sortedCats] };
  } catch (err) {
    console.warn('[faqService] Unexpected error, using fallback:', err);
    return { faqs: FALLBACK_FAQS, categories: ['All', ...FALLBACK_CATEGORIES] };
  }
}

// ─── Vote recording ───────────────────────────────────────────

const DEVICE_ID_KEY = '@faq_device_id';

async function getOrCreateDeviceId(): Promise<string> {
  try {
    let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      // Generate a simple UUID-like identifier without external deps
      id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
      await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Records a yes/no vote for a FAQ question. Fire-and-forget — never throws.
 * Enforces once-per-device uniqueness (authenticated users use user_id).
 */
export async function recordFaqVote(
  faqItemId: string,
  vote: 'yes' | 'no',
  userId?: string,
): Promise<void> {
  try {
    const params: Record<string, unknown> = {
      p_faq_item_id: faqItemId,
      p_vote: vote,
    };
    if (userId) {
      params.p_user_id = userId;
    } else {
      params.p_anonymous_id = await getOrCreateDeviceId();
    }
    await supabase.rpc('rpc_record_faq_vote', params as any);
  } catch (err) {
    console.warn('[faqService] recordFaqVote error (non-blocking):', err);
  }
}
