import { Heading, Section, Text } from 'react-email';
import type { ReactNode } from 'react';
import { theme } from './theme';

/**
 * The Arabic half of a bilingual transactional mail.
 *
 * Cart-recovery ships English then Arabic under a hairline, because the
 * auth flow does not yet know the recipient's language and a locale-only
 * template would be wrong for half the market. OTP / welcome / verification
 * follow the same shape: one payload (the code, the link) in the English
 * half, then this block restates the instruction in Arabic.
 */
export function BilingualHalf({
  title,
  body,
  children,
}: {
  title: string;
  body: ReactNode;
  children?: ReactNode;
}) {
  return (
    <>
      <Section style={divider} />
      <Section style={rtlBlock} dir="rtl">
        <Heading as="h2" style={titleAr}>
          {title}
        </Heading>
        <Text style={bodyAr}>{body}</Text>
        {children}
      </Section>
    </>
  );
}

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
