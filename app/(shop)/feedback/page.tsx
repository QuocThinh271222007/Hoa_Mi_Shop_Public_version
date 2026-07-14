import { getFeedbackItems } from '@/lib/feedback/items';
import { getPadletPosts } from '@/lib/feedback/padlet';
import { getSettingsMap } from '@/lib/admin/settings-data';
import FeedbackClient from './FeedbackClient';
import './feedback.css';

export const dynamic = 'force-dynamic';

export default async function FeedbackPage() {
  const [items, padletPosts, settings] = await Promise.all([
    getFeedbackItems(),
    getPadletPosts(),
    getSettingsMap([
      'feedback_padlet_title',
      'feedback_padlet_bg_type',
      'feedback_padlet_bg_color',
      'feedback_padlet_bg_gradient',
      'feedback_padlet_bg_image',
    ]).catch(() => ({}) as Record<string, string>),
  ]);
  return (
    <FeedbackClient
      items={items}
      padletPosts={padletPosts}
      padletTitle={settings.feedback_padlet_title}
      padletBg={{
        type: settings.feedback_padlet_bg_type || 'gradient',
        color: settings.feedback_padlet_bg_color || '',
        gradient: settings.feedback_padlet_bg_gradient || '',
        image: settings.feedback_padlet_bg_image || '',
      }}
    />
  );
}
