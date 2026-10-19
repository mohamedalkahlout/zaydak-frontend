import { Heading, Text } from 'react-email';
import { EmailShell } from './_components/email-shell';
import { BilingualHalf } from './_components/bilingual-half';
import { PrimaryButton } from './_components/primary-button';
import { theme } from './_components/theme';

export interface WelcomeEmailProps {
  name: string;
  /** Optional deep-link into the vendor or storefront app. */
  ctaUrl?: string;
  ctaLabel?: string;
  year?: number | string;
}

export function WelcomeEmail({
  name,
  ctaUrl,
  ctaLabel = 'Open Zaydak',
  year,
}: WelcomeEmailProps) {
  return (
    <EmailShell
      preview={`Welcome to Zaydak, ${name} · مرحباً بك في زيداك، ${name}`}
      year={year}
    >
      <Text style={eyebrow}>You are in</Text>
      <Heading as="h1" style={title}>
        Welcome, {name}
      </Heading>
      <Text style={body}>
        Your account is ready. Browse shops, manage orders, and run your
        storefront from one place — we are glad you are here.
      </Text>
      {ctaUrl ? (
        <PrimaryButton href={ctaUrl}>{ctaLabel}</PrimaryButton>
      ) : null}
      <Text style={muted}>
        Questions? Reply to this email and a human on the Zaydak team will
        get back to you.
      </Text>
      <BilingualHalf
        title={`مرحباً، ${name}`}
        body="حسابك جاهز. تصفّح المتاجر، أدِر الطلبات، وشغّل متجرك من مكان واحد — سعداء بوجودك معنا. أسئلة؟ رد على هذه الرسالة وسيتواصل معك أحد من فريق زيداك."
      >
        {ctaUrl ? (
          <PrimaryButton href={ctaUrl}>افتح زيداك</PrimaryButton>
        ) : null}
      </BilingualHalf>
    </EmailShell>
  );
}

WelcomeEmail.PreviewProps = {
  name: 'Sara',
  ctaUrl: 'https://app.zaydak.com',
  year: 2026,
} satisfies WelcomeEmailProps;

export default WelcomeEmail;

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
  fontSize: '26px',
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

const muted = {
  margin: '24px 0 0',
  fontSize: '13px',
  lineHeight: '20px',
  color: theme.muted,
};
