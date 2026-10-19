import { Heading, Text } from 'react-email';
import { EmailShell } from './_components/email-shell';
import { PrimaryButton } from './_components/primary-button';
import { theme } from './_components/theme';

export interface BackInStockEmailProps {
  productName: string;
  productUrl?: string;
  year?: number | string;
}

export function BackInStockEmail({
  productName,
  productUrl,
  year,
}: BackInStockEmailProps) {
  return (
    <EmailShell
      preview={`${productName} is back in stock`}
      year={year}
    >
      <Text style={eyebrow}>Back in stock</Text>
      <Heading as="h1" style={title}>
        Good news
      </Heading>
      <Text style={body}>
        <strong style={strong}>{productName}</strong> is available again.
        Grab it before it sells out.
      </Text>
      {productUrl ? (
        <PrimaryButton href={productUrl}>View product</PrimaryButton>
      ) : null}
    </EmailShell>
  );
}

BackInStockEmail.PreviewProps = {
  productName: 'Blue Mug',
  productUrl: 'https://acme.example.com/products/blue-mug',
  year: 2026,
} satisfies BackInStockEmailProps;

export default BackInStockEmail;

const eyebrow = {
  margin: '0 0 8px',
  fontSize: '12px',
  fontWeight: 600 as const,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: theme.accentInk,
};

const title = {
  margin: '0 0 12px',
  fontSize: '24px',
  fontWeight: 700 as const,
  letterSpacing: '-0.02em',
  color: theme.ink,
  lineHeight: '1.25',
};

const body = {
  margin: '0 0 24px',
  fontSize: '15px',
  lineHeight: '24px',
  color: theme.muted,
};

const strong = {
  color: theme.ink,
};
