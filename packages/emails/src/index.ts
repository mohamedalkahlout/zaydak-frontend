export {
  renderOtpEmail,
  renderWelcomeEmail,
  renderEmailVerificationEmail,
  renderCartRecoveryEmail,
  renderBackInStockEmail,
  renderNotificationEmail,
  renderContactReplyEmail,
} from './render';

export type {
  RenderedEmail,
  OtpEmailProps,
  WelcomeEmailProps,
  EmailVerificationEmailProps,
  CartRecoveryEmailProps,
  BackInStockEmailProps,
  NotificationEmailProps,
  ContactReplyEmailProps,
} from './render';

export { theme } from '../emails/_components/theme';
