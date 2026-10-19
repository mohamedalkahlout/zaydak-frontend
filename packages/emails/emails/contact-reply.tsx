import { Fragment } from 'react';
import { Heading, Link, Section, Text } from 'react-email';
import { EmailShell } from './_components/email-shell';
import { theme } from './_components/theme';

export interface ContactReplyEmailProps {
  shopName: string;
  /** One language per email: the reply is one conversation, in one language. */
  lang: 'ar' | 'en';
  /** The merchant's words, as typed. Rendered as text, never as HTML. */
  replyBody: string;
  /** The shop's storefront contact page, where the customer can write again. */
  contactUrl: string;
  /**
   * Where the recipient can report this email: a `mailto:` to the platform's
   * abuse mailbox, or an `https:` page. Omitted, the footer carries no report
   * line. Any other scheme is dropped rather than linked.
   */
  reportUrl?: string;
  year?: number | string;
}

const COPY = {
  en: {
    heading: (shop: string) => `${shop} replied to your message`,
    answer: (shop: string) => `Reply to this email to answer ${shop}.`,
    againBefore: 'You can also write to them again from their ',
    againLink: 'contact page',
    againAfter: '.',
    provenance: (shop: string) =>
      `You received this because a message was sent to ${shop} from this address through its contact form. If that wasn't you, you can ignore this email.`,
    reportBefore: 'Unwanted or abusive? ',
    reportLink: `Report this email to ${theme.brand}`,
    reportAfter: '.',
  },
  ar: {
    heading: (shop: string) => `ردّ ${shop} على رسالتك`,
    answer: (shop: string) => `للرد على ${shop}، أجب على هذه الرسالة مباشرة.`,
    againBefore: 'يمكنك أيضًا مراسلتهم من جديد عبر ',
    againLink: 'صفحة التواصل',
    againAfter: ' في متجرهم.',
    provenance: (shop: string) =>
      `وصلتك هذه الرسالة لأن رسالة أُرسلت إلى ${shop} من هذا العنوان عبر نموذج التواصل في متجره. إن لم تكن أنت المرسل، يمكنك تجاهل هذه الرسالة.`,
    reportBefore: 'رسالة غير مرغوب فيها أو مسيئة؟ ',
    reportLink: 'أبلغ زايدك عنها',
    reportAfter: '.',
  },
} as const;

/**
 * A merchant's answer to somebody who wrote through the storefront contact
 * form, sent from the shop inbox.
 *
 * **It does not quote the customer's original message**, and that is a safety
 * property rather than a style choice. The form never verifies the address it
 * is given, and a typo'd address is a documented case — so the person reading
 * this may not be the person who wrote. A quote would forward the customer's
 * words, and often their order number, to a stranger.
 *
 * The footer says why the email arrived, for the same reason: somebody who
 * never wrote to the shop can tell at a glance that they can ignore it.
 *
 * **And, when `reportUrl` is given, where to complain.** The email leaves from
 * the platform's own domain, which also carries every sign-in code, and the
 * only button a mail client offers a stranger is "spam". A report line under
 * the provenance note gives them a better one: it reaches the platform, and
 * the link names the reply so staff can find the shop behind it.
 */
export function ContactReplyEmail({
  shopName,
  lang,
  replyBody,
  contactUrl,
  reportUrl,
  year,
}: ContactReplyEmailProps) {
  const copy = COPY[lang] ?? COPY.en;
  const rtl = lang === 'ar';
  const lines = replyBody.split(/\r?\n/);
  const report = safeReportUrl(reportUrl);

  return (
    <EmailShell
      preview={copy.heading(shopName)}
      shopName={shopName}
      year={year}
      dir={rtl ? 'rtl' : 'ltr'}
      lang={lang}
      footerNote={copy.provenance(shopName)}
      footerExtra={
        report ? (
          <>
            {copy.reportBefore}
            <Link href={report} style={footerLink}>
              {copy.reportLink}
            </Link>
            {copy.reportAfter}
          </>
        ) : undefined
      }
    >
      <Section dir={rtl ? 'rtl' : 'ltr'} style={rtl ? rtlBlock : ltrBlock}>
        <Heading as="h1" style={title}>
          {copy.heading(shopName)}
        </Heading>
        <Section style={rtl ? replyCardRtl : replyCard}>
          <Text style={replyText}>
            {lines.map((line, i) => (
              <Fragment key={i}>
                {i > 0 ? <br /> : null}
                {line}
              </Fragment>
            ))}
          </Text>
        </Section>
        <Text style={body}>{copy.answer(shopName)}</Text>
        <Text style={muted}>
          {copy.againBefore}
          <Link href={contactUrl} style={link}>
            {copy.againLink}
          </Link>
          {copy.againAfter}
        </Text>
      </Section>
    </EmailShell>
  );
}

/**
 * Only a `mailto:` or an `https:` page becomes a link. The caller builds this
 * from configuration, but an href is the one place a wrong value turns into
 * something a reader can click.
 */
function safeReportUrl(value: string | undefined): string | undefined {
  return value && /^(mailto:|https:\/\/)/i.test(value) ? value : undefined;
}

ContactReplyEmail.PreviewProps = {
  shopName: 'Acme',
  lang: 'en',
  replyBody:
    'Hi Sara,\n\nYour order left our warehouse this morning and should reach you by Thursday.\n\nThanks for your patience.',
  contactUrl: 'https://zaydak.com/acme/contact',
  reportUrl:
    'mailto:abuse@zaydak.com?subject=Report%3A%20contact%20reply%20preview',
  year: 2026,
} satisfies ContactReplyEmailProps;

export default ContactReplyEmail;

const ltrBlock = {
  direction: 'ltr' as const,
  textAlign: 'left' as const,
};

const rtlBlock = {
  direction: 'rtl' as const,
  textAlign: 'right' as const,
};

const title = {
  margin: '0 0 16px',
  fontSize: '22px',
  fontWeight: 700 as const,
  letterSpacing: '-0.02em',
  color: theme.ink,
  lineHeight: '1.3',
};

const replyCard = {
  margin: '0 0 20px',
  padding: '4px 16px',
  backgroundColor: theme.paper,
  borderLeft: `3px solid ${theme.accent}`,
  borderRadius: '4px',
};

const replyCardRtl = {
  ...replyCard,
  borderLeft: 'none',
  borderRight: `3px solid ${theme.accent}`,
};

const replyText = {
  margin: '12px 0',
  fontSize: '15px',
  lineHeight: '24px',
  color: theme.ink,
  whiteSpace: 'normal' as const,
};

const body = {
  margin: '0 0 8px',
  fontSize: '15px',
  lineHeight: '24px',
  color: theme.ink,
};

const muted = {
  margin: '0',
  fontSize: '14px',
  lineHeight: '22px',
  color: theme.muted,
};

const link = {
  color: theme.accentInk,
  textDecoration: 'underline',
};

/** Muted like the footer it sits in: findable, not a call to action. */
const footerLink = {
  color: theme.muted,
  textDecoration: 'underline',
};
