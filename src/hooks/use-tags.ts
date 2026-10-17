'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Tag } from '@/lib/types';

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('tags')
        .select('id, name, color')
        .order('name');
      if (error) throw new Error(error.message);
      return (data ?? []) as Tag[];
    },
  });
}
