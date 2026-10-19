import { Button } from 'react-email';
import { theme } from './theme';

export function PrimaryButton({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
  return (
    <Button href={href} style={button}>
      {children}
    </Button>
  );
}

const button = {
  display: 'inline-block',
  backgroundColor: theme.ink,
  color: theme.card,
  fontSize: '15px',
  fontWeight: 600 as const,
  textDecoration: 'none',
  padding: '14px 28px',
  borderRadius: '8px',
  lineHeight: '1',
};
