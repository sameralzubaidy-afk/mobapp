// FILE: p2p-kids-marketplace/src/services/educationContentService.ts
// MODULE-18 V1 EDU-003: Education content service (mobile read-only)

import { supabase } from '../config/supabase';
import type { EducationSection, SectionType } from '../types/education';

/**
 * Get all published education sections
 * Ordered by display_order
 * Cached for 5 minutes (React Query staleTime)
 *
 * @returns Array of published sections
 */
export async function getPublishedSections(): Promise<EducationSection[]> {
  try {
    const { data, error } = await supabase
      .from('education_sections')
      .select(
        `
        id,
        title,
        body,
        image_url,
        display_order,
        section_type,
        is_published,
        published_at,
        created_at
      `
      )
      .eq('is_published', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    return (data || []) as EducationSection[];
  } catch (error: any) {
    console.error('[educationContentService] Get published sections error:', error);
    return [];
  }
}

/**
 * Get a single published section by type
 * Returns null if no published section exists for this type
 *
 * @param type - Section type
 * @returns Published section or null
 */
export async function getSectionByType(type: SectionType): Promise<EducationSection | null> {
  try {
    const { data, error } = await supabase
      .from('education_sections')
      .select(
        `
        id,
        title,
        body,
        image_url,
        display_order,
        section_type,
        is_published,
        published_at,
        created_at
      `
      )
      .eq('section_type', type)
      .eq('is_published', true)
      .maybeSingle();

    if (error) throw error;

    return data as EducationSection | null;
  } catch (error: any) {
    console.error(`[educationContentService] Get section by type (${type}) error:`, error);
    return null;
  }
}
