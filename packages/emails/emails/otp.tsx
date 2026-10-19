import { Heading, Section, Text } from 'react-email';
import { EmailShell } from './_components/email-shell';
import { BilingualHalf } from './_components/bilingual-half';
import { theme } from './_components/theme';

export interface OtpEmailProps {
  code: string;
  /** Minutes until expiry — shown in the notice line. */
  expiresIn?: number | string;
  year?: number | string;
}

export function OtpEmail({
  code,
  expiresIn = 5,
  year,
}: OtpEmailProps) {
  return (
    <EmailShell
      preview={`Your Zaydak code is ${code} · رمز زيداك هو ${code}`}
      year={year}
    >
      <Text style={eyebrow}>Verification code</Text>
      <Heading as="h1" style={title}>
        Enter this code to continue
      </Heading>
      <Text style={body}>
        Use the code below to finish signing in. It works once and expires
        shortly — do not share it with anyone.
      </Text>
      <Section style={codeBox}>
        <Text style={codeText}>{code}</Text>
      </Section>
      <Text style={notice}>
        Expires in <strong style={strong}>{expiresIn} minutes</strong>
      </Text>
      <Text style={muted}>
        If you did not request this code, you can ignore this email.
      </Text>
      <BilingualHalf
        title="أدخل هذا الرمز للمتابعة"
        body={
          <>
            استخدم الرمز أعلاه لإكمال تسجيل الدخول. يعمل مرة واحدة وينتهي
            قريباً — لا تشاركه مع أحد. ينتهي خلال{' '}
            <strong style={strong}>{expiresIn} دقائق</strong>. إذا لم تطلب هذا
            الرمز يمكنك تجاهل هذه الرسالة.
          </>
        }
      />
    </EmailShell>
  );
}

OtpEmail.PreviewProps = {
  code: '482917',
  expiresIn: 5,
  year: 2026,
} satisfies OtpEmailProps;

export default OtpEmail;

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

const codeBox = {
  backgroundColor: theme.accentSoft,
  border: `2px dashed ${theme.accent}`,
  borderRadius: '10px',
  padding: '20px 16px',
  textAlign: 'center' as const,
  margin: '0 0 16px',
};

const codeText = {
  margin: '0',
  fontSize: '36px',
  fontWeight: 700 as const,
  letterSpacing: '0.28em',
  color: theme.ink,
  fontFamily:
    'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace',
};

const notice = {
  margin: '0 0 20px',
  fontSize: '13px',
  lineHeight: '20px',
  color: theme.muted,
  textAlign: 'center' as const,
};

const strong = {
  color: theme.ink,
};

const muted = {
  margin: '0',
  fontSize: '13px',
  lineHeight: '20px',
  color: theme.muted,
};
