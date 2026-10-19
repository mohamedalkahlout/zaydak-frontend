import { Column, Heading, Row, Section, Text } from 'react-email';
import { EmailShell } from './_components/email-shell';
import { PrimaryButton } from './_components/primary-button';
import { theme } from './_components/theme';

export interface CartRecoveryItem {
  name: string;
  quantity: number | string;
  price: string;
}

export interface CartRecoveryEmailProps {
  name: string;
  shopName: string;
  cartUrl: string;
  items: CartRecoveryItem[];
  moreCount?: number | string;
  total: string;
  year?: number | string;
}

export function CartRecoveryEmail({
  name,
  shopName,
  cartUrl,
  items,
  moreCount = 0,
  total,
  year,
}: CartRecoveryEmailProps) {
  const overflow = Number(moreCount) || 0;

  return (
    <EmailShell
      preview={`${shopName}: your cart is waiting`}
      shopName={shopName}
      year={year}
      footerNote={`© ${year ?? new Date().getFullYear()} ${shopName}`}
    >
      <Heading as="h1" style={title}>
        Hi {name}, your cart is still here
      </Heading>
      <Text style={body}>
        You left the items below at {shopName}. They are saved and ready
        whenever you are.
      </Text>

      <Section style={table}>
        {items.map((item, i) => (
          <Row key={`${item.name}-${i}`} style={row}>
            <Column style={qtyCol}>
              <Text style={qtyText}>{item.quantity}×</Text>
            </Column>
            <Column style={nameCol}>
              <Text style={itemName}>{item.name}</Text>
            </Column>
            <Column style={priceCol} align="right">
              <Text style={itemPrice}>{item.price}</Text>
            </Column>
          </Row>
        ))}
        {overflow > 0 ? (
          <Row style={row}>
            <Column>
              <Text style={more}>and {overflow} more item(s)</Text>
            </Column>
          </Row>
        ) : null}
        <Row style={totalRow}>
          <Column>
            <Text style={totalLabel}>Total</Text>
          </Column>
          <Column align="right">
            <Text style={totalValue}>{total}</Text>
          </Column>
        </Row>
      </Section>

      <Section style={ctaWrap}>
        <PrimaryButton href={cartUrl}>Return to my cart</PrimaryButton>
      </Section>

      <Section style={divider} />

      <Section style={rtlBlock} dir="rtl">
        <Heading as="h2" style={titleAr}>
          مرحباً {name}، سلتك ما زالت محفوظة
        </Heading>
        <Text style={bodyAr}>
          تركت المنتجات أعلاه في سلة التسوق لدى {shopName}. السلة محفوظة
          وجاهزة في أي وقت.
        </Text>
        <Section style={ctaWrap}>
          <PrimaryButton href={cartUrl}>أكمل طلبك الآن</PrimaryButton>
        </Section>
      </Section>
    </EmailShell>
  );
}

CartRecoveryEmail.PreviewProps = {
  name: 'Sara',
  shopName: 'Acme',
  cartUrl: 'https://acme.example.com/cart',
  items: [
    { name: 'Blue Mug', quantity: 2, price: '100.00 SAR' },
    { name: 'Linen Tote', quantity: 1, price: '85.00 SAR' },
  ],
  moreCount: 0,
  total: '185.00 SAR',
  year: 2026,
} satisfies CartRecoveryEmailProps;

export default CartRecoveryEmail;

const title = {
  margin: '0 0 12px',
  fontSize: '22px',
  fontWeight: 700 as const,
  letterSpacing: '-0.02em',
  color: theme.ink,
  lineHeight: '1.3',
};

const body = {
  margin: '0 0 20px',
  fontSize: '15px',
  lineHeight: '24px',
  color: theme.muted,
};

const table = {
  width: '100%',
  margin: '0 0 8px',
};

const row = {
  borderBottom: `1px solid ${theme.hairline}`,
};

const qtyCol = { width: '40px', verticalAlign: 'top' as const };
const nameCol = { verticalAlign: 'top' as const };
const priceCol = { width: '110px', verticalAlign: 'top' as const };

const qtyText = {
  margin: '10px 0',
  fontSize: '14px',
  color: theme.muted,
};

const itemName = {
  margin: '10px 0',
  fontSize: '14px',
  color: theme.ink,
  lineHeight: '20px',
};

const itemPrice = {
  margin: '10px 0',
  fontSize: '14px',
  color: theme.ink,
  whiteSpace: 'nowrap' as const,
};

const more = {
  margin: '10px 0',
  fontSize: '13px',
  color: theme.muted,
};

const totalRow = {
  borderBottom: 'none',
};

const totalLabel = {
  margin: '14px 0 0',
  fontSize: '15px',
  fontWeight: 700 as const,
  color: theme.ink,
};

const totalValue = {
  margin: '14px 0 0',
  fontSize: '15px',
  fontWeight: 700 as const,
  color: theme.ink,
  whiteSpace: 'nowrap' as const,
};

const ctaWrap = {
  margin: '24px 0 8px',
  textAlign: 'center' as const,
};

const divider = {
  borderTop: `1px solid ${theme.hairline}`,
  margin: '28px 0 8px',
  fontSize: '0',
  lineHeight: '0',
};

const rtlBlock = {
  direction: 'rtl' as const,
  textAlign: 'right' as const,
};

const titleAr = {
  margin: '0 0 12px',
  fontSize: '20px',
  fontWeight: 700 as const,
  color: theme.ink,
  lineHeight: '1.35',
};

const bodyAr = {
  margin: '0 0 8px',
  fontSize: '15px',
  lineHeight: '26px',
  color: theme.muted,
};
