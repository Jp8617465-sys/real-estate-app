'use client';

import { cn } from '@/lib/utils';
import type { MessageChannel } from '@realflow/shared';

interface ChannelIconProps {
  channel: MessageChannel;
  className?: string;
  showLabel?: boolean;
}

const CHANNEL_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  email: { icon: 'M', label: 'Email', color: 'bg-blue-100 text-blue-700' },
  sms: { icon: 'S', label: 'SMS', color: 'bg-green-100 text-green-700' },
  phone_call: { icon: 'P', label: 'Phone', color: 'bg-purple-100 text-purple-700' },
  whatsapp: { icon: 'W', label: 'WhatsApp', color: 'bg-emerald-100 text-emerald-700' },
  instagram_dm: { icon: 'I', label: 'Instagram', color: 'bg-pink-100 text-pink-700' },
  facebook_messenger: { icon: 'F', label: 'Messenger', color: 'bg-indigo-100 text-indigo-700' },
  domain_enquiry: { icon: 'D', label: 'Domain', color: 'bg-teal-100 text-teal-700' },
  rea_enquiry: { icon: 'R', label: 'REA', color: 'bg-red-100 text-red-700' },
  linkedin: { icon: 'L', label: 'LinkedIn', color: 'bg-sky-100 text-sky-700' },
  internal_note: { icon: 'N', label: 'Note', color: 'bg-yellow-100 text-yellow-700' },
  portal_notification: { icon: 'P', label: 'Portal', color: 'bg-gray-100 text-gray-700' },
};

export function ChannelIcon({ channel, className, showLabel }: ChannelIconProps) {
  const config = CHANNEL_CONFIG[channel] ?? { icon: '?', label: channel, color: 'bg-gray-100 text-gray-700' };

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span
        className={cn(
          'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
          config.color,
        )}
        title={config.label}
      >
        {config.icon}
      </span>
      {showLabel && (
        <span className="text-xs text-gray-500">{config.label}</span>
      )}
    </span>
  );
}

export function getChannelLabel(channel: MessageChannel): string {
  return CHANNEL_CONFIG[channel]?.label ?? channel;
}
