import { Heading, Text } from 'react-email';
import { EmailShell } from './_components/email-shell';
import { BilingualHalf } from './_components/bilingual-half';
import { PrimaryButton } from './_components/primary-button';
import { theme } from './_components/theme';

export interface EmailVerificationEmailProps {
  name: string;
  link: string;
  year?: number | string;
}

export function EmailVerificationEmail({
  name,
  link,
  year,
}: EmailVerificationEmailProps) {
  return (
    <EmailShell
      preview="Confirm your email address · أكّد بريدك الإلكتروني"
      year={year}
    >
      <Text style={eyebrow}>Email confirmation</Text>
      <Heading as="h1" style={title}>
        Hi {name}, confirm it is you
      </Heading>
      <Text style={body}>
        Tap the button below to verify this address. The link expires soon —
        after that, request a fresh one from your account settings.
      </Text>
      <PrimaryButton href={link}>Verify email</PrimaryButton>
      <Text style={muted}>
        If the button does not work, paste this URL into your browser:
      </Text>
      <Text style={linkText}>{link}</Text>
      <Text style={muted}>
        If you did not create a Zaydak account, you can ignore this email.
      </Text>
      <BilingualHalf
        title={`مرحباً ${name}، أكّد أنه أنت`}
        body="اضغط الزر أدناه للتحقق من هذا العنوان. الرابط ينتهي قريباً — بعدها اطلب رابطاً جديداً من إعدادات حسابك. إذا لم تنشئ حساباً في زيداك يمكنك تجاهل هذه الرسالة."
      >
        <PrimaryButton href={link}>تأكيد البريد</PrimaryButton>
        <Text style={mutedAr}>إذا لم يعمل الزر، الصق هذا الرابط في المتصفح:</Text>
        <Text style={linkText}>{link}</Text>
      </BilingualHalf>
    </EmailShell>
  );
}

EmailVerificationEmail.PreviewProps = {
  name: 'Sara',
  link: 'https://app.zaydak.com/verify-email?token=example',
  year: 2026,
} satisfies EmailVerificationEmailProps;

export default EmailVerificationEmail;

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

const muted = {
  margin: '20px 0 0',
  fontSize: '13px',
  lineHeight: '20px',
  color: theme.muted,
};

const mutedAr = {
  margin: '16px 0 0',
  fontSize: '13px',
  lineHeight: '20px',
  color: theme.muted,
};

const linkText = {
  margin: '8px 0 0',
  fontSize: '12px',
  lineHeight: '18px',
  color: theme.accentInk,
  wordBreak: 'break-all' as const,
};
