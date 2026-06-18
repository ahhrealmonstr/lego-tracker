import { getConfig } from '../config';
import type { InstructionBooklet } from '../types/lego';

export async function fetchInstructionBooklets(setNum: string): Promise<{
  booklets: InstructionBooklet[];
  legoUrl: string;
}> {
  const { supabaseUrl } = getConfig();
  if (!supabaseUrl) return { booklets: [], legoUrl: '' };

  const url = `${supabaseUrl}/functions/v1/instructions?set_num=${encodeURIComponent(setNum)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return { booklets: [], legoUrl: '' };
    return await res.json() as { booklets: InstructionBooklet[]; legoUrl: string };
  } catch {
    return { booklets: [], legoUrl: '' };
  }
}
