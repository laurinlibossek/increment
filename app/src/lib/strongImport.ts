// The picked file stays in memory until the pushed review screen imports or
// closes. Cancelling, Back and a reload never leave records or aliases behind.
import { router } from 'expo-router';
import type { StrongReview } from '@/data/store';

let pending: StrongReview | null = null;
export function reviewStrongImport(preview: StrongReview) {
  pending = preview;
  router.push('/strong-import');
}
export const currentStrongImport = () => pending;
export function closeStrongImport(preview: StrongReview) {
  if (pending === preview) pending = null;
}
