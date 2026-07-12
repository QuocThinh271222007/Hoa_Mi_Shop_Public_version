import { getFeedbackItems } from '@/lib/feedback/items';
import { getSettingsMap } from '@/lib/admin/settings-data';
import FeedbackClient from './FeedbackClient';
import './feedback.css';

export const dynamic = 'force-dynamic';

export default async function FeedbackPage() {
  const [items, settings] = await Promise.all([
    getFeedbackItems(),
    getSettingsMap(['feedback_padlet_title']).catch(() => ({}) as Record<string, string>),
  ]);
  return <FeedbackClient items={items} padletTitle={settings.feedback_padlet_title} />;
}
