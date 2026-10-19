import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { toPlainText } from 'react-email';
import {
  OtpEmail,
  type OtpEmailProps,
} from '../emails/otp';
import {
  WelcomeEmail,
  type WelcomeEmailProps,
} from '../emails/welcome';
import {
  EmailVerificationEmail,
  type EmailVerificationEmailProps,
} from '../emails/email-verification';
import {
  CartRecoveryEmail,
  type CartRecoveryEmailProps,
} from '../emails/cart-recovery';
import {
  BackInStockEmail,
  type BackInStockEmailProps,
} from '../emails/back-in-stock';
import {
  NotificationEmail,
  type NotificationEmailProps,
} from '../emails/notification';
import {
  ContactReplyEmail,
  type ContactReplyEmailProps,
} from '../emails/contact-reply';

export type RenderedEmail = {
  html: string;
  text: string;
};

/**
 * Use `renderToStaticMarkup` rather than `react-email`'s `render()`.
 * The latter dynamic-imports `react-dom/server`, which breaks Jest's default
 * CJS environment (`--experimental-vm-modules` required) while Nest and plain
 * Node are fine. Static markup is enough for these templates: no Suspense,
 * no streaming, no pretty-print.
 */
function renderEmail<P extends object>(
  Component: ComponentType<P>,
  props: P,
): RenderedEmail {
  const markup = renderToStaticMarkup(createElement(Component, props));
  const html =
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">' +
    markup;
  return { html, text: toPlainText(html) };
}

export function renderOtpEmail(props: OtpEmailProps): Promise<RenderedEmail> {
  return Promise.resolve(renderEmail(OtpEmail, props));
}

export function renderWelcomeEmail(
  props: WelcomeEmailProps,
): Promise<RenderedEmail> {
  return Promise.resolve(renderEmail(WelcomeEmail, props));
}

export function renderEmailVerificationEmail(
  props: EmailVerificationEmailProps,
): Promise<RenderedEmail> {
  return Promise.resolve(renderEmail(EmailVerificationEmail, props));
}

export function renderCartRecoveryEmail(
  props: CartRecoveryEmailProps,
): Promise<RenderedEmail> {
  return Promise.resolve(renderEmail(CartRecoveryEmail, props));
}

export function renderBackInStockEmail(
  props: BackInStockEmailProps,
): Promise<RenderedEmail> {
  return Promise.resolve(renderEmail(BackInStockEmail, props));
}

export function renderNotificationEmail(
  props: NotificationEmailProps,
): Promise<RenderedEmail> {
  return Promise.resolve(renderEmail(NotificationEmail, props));
}

export function renderContactReplyEmail(
  props: ContactReplyEmailProps,
): Promise<RenderedEmail> {
  return Promise.resolve(renderEmail(ContactReplyEmail, props));
}

export type {
  OtpEmailProps,
  WelcomeEmailProps,
  EmailVerificationEmailProps,
  CartRecoveryEmailProps,
  BackInStockEmailProps,
  NotificationEmailProps,
  ContactReplyEmailProps,
};
