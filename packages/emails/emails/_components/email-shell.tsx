import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from 'react-email';
import type { ReactNode } from 'react';
import { theme } from './theme';

export interface EmailShellProps {
  preview: string;
  children: ReactNode;
  /** Footer line under the card. Defaults to © year Zaydak. */
  footerNote?: string;
  /**
   * A second footer line, for one that needs a link — the note above is plain
   * text. Rendered under it in the same muted type.
   */
  footerExtra?: ReactNode;
  year?: number | string;
  /** When set, the shell is shop-branded (no Zaydak wordmark in header). */
  shopName?: string;
  dir?: 'ltr' | 'rtl';
  lang?: string;
}

/**
 * Shared Gmail-safe shell: paper ground, white card, accent hairline under
 * the header, muted footer. All colour is inline — clients strip <style>.
 */
export function EmailShell({
  preview,
  children,
  footerNote,
  footerExtra,
  year = new Date().getFullYear(),
  shopName,
  dir = 'ltr',
  lang = 'en',
}: EmailShellProps) {
  const title = shopName ?? theme.brand;
  const note =
    footerNote ?? `© ${year} ${theme.brand}. All rights reserved.`;

  return (
    <Html dir={dir} lang={lang}>
      <Head />
      <Preview>{preview}</Preview>
      {/* `Body` defaults to `dir="ltr" lang="en"` on its own element, which
          overrode `Html`'s direction and laid an Arabic email out
          left-to-right. Passed through so a one-language rtl email is rtl
          all the way down; every caller that omits it still gets ltr. */}
      <Body style={body} dir={dir} lang={lang}>
        <Container style={container}>
          <Section style={header}>
            <Text style={wordmark}>{title}</Text>
            <Section style={accentBar} />
          </Section>
          <Section style={content}>{children}</Section>
          <Section style={footer}>
            <Text style={footerText}>{note}</Text>
            {footerExtra ? (
              <Text style={footerExtraText}>{footerExtra}</Text>
            ) : null}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  margin: '0',
  padding: '0',
  backgroundColor: theme.paper,
  fontFamily: theme.font,
  color: theme.ink,
};

const container = {
  margin: '0 auto',
  padding: '32px 16px',
  maxWidth: '560px',
};

const header = {
  backgroundColor: theme.card,
  borderRadius: '12px 12px 0 0',
  border: `1px solid ${theme.hairline}`,
  borderBottom: 'none',
  padding: '28px 32px 0',
};

const wordmark = {
  margin: '0 0 20px',
  fontSize: '22px',
  fontWeight: 700 as const,
  letterSpacing: '-0.02em',
  color: theme.ink,
  lineHeight: '1.2',
};

const accentBar = {
  height: '3px',
  width: '100%',
  backgroundColor: theme.accent,
  borderRadius: '2px 2px 0 0',
  // Section needs content; a zero-height bar can collapse in some clients.
  fontSize: '0',
  lineHeight: '0',
};

const content = {
  backgroundColor: theme.card,
  border: `1px solid ${theme.hairline}`,
  borderTop: 'none',
  borderBottom: 'none',
  padding: '28px 32px',
};

const footer = {
  backgroundColor: theme.card,
  borderRadius: '0 0 12px 12px',
  border: `1px solid ${theme.hairline}`,
  borderTop: `1px solid ${theme.hairline}`,
  padding: '20px 32px 24px',
};

const footerText = {
  margin: '0',
  fontSize: '12px',
  lineHeight: '18px',
  color: theme.muted,
  textAlign: 'center' as const,
};

const footerExtraText = {
  ...footerText,
  margin: '8px 0 0',
};
