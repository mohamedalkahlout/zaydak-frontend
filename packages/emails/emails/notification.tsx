import { Heading, Text } from 'react-email';
import { EmailShell } from './_components/email-shell';
import { theme } from './_components/theme';

export interface NotificationEmailProps {
  body: string;
  year?: number | string;
}

/**
 * Thin branded wrapper for staff / system notification sentences that are
 * already fully written by the caller (NotifyLogsService).
 */
export function NotificationEmail({
  body,
  year,
}: NotificationEmailProps) {
  return (
    <EmailShell preview={body.slice(0, 90)} year={year}>
      <Heading as="h1" style={title}>
        Update
      </Heading>
      <Text style={bodyStyle}>{body}</Text>
    </EmailShell>
  );
}

NotificationEmail.PreviewProps = {
  body: 'Order #1042 was marked as shipped.',
  year: 2026,
} satisfies NotificationEmailProps;

export default NotificationEmail;

const title = {
  margin: '0 0 12px',
  fontSize: '20px',
  fontWeight: 700 as const,
  color: theme.ink,
};

const bodyStyle = {
  margin: '0',
  fontSize: '15px',
  lineHeight: '24px',
  color: theme.muted,
};
