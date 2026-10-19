/**
 * The message a newsletter signup composes **when the mutation could not run**.
 *
 * This used to be the whole feature, and the comment here used to say there was
 * no subscribe operation on the API. There is: `subscribeNewsletter` shipped,
 * and `NewsletterPanel` calls it. So this is now the fallback on the one path
 * the mutation cannot answer — the request never reaching the server — where
 * handing the message to the visitor's own mail client is still better than
 * losing it, and the panel says plainly that a mail app is opening.
 *
 * It is pulled out of the component because the interesting part is the
 * escaping, and escaping is the half that fails quietly. Every one of these
 * arrives from somewhere untrusted or unbounded: the address is vendor-entered
 * shop settings, the subject carries the vendor's shop name, and the body
 * carries whatever the visitor typed into the field. An unescaped `&` in a shop
 * name silently truncates the body; a newline in either splits the URL.
 */
export function buildSubscribeMailto(args: {
  contact: string
  subject: string
  body: string
}): string {
  const query = new URLSearchParams({
    subject: args.subject,
    body: args.body,
  })

  return `mailto:${encodeAddress(args.contact)}?${percentEncodeSpaces(query.toString())}`
}

/**
 * `@` is part of the addr-spec's own syntax in a `mailto:` (RFC 6068 §2), so it
 * is one of the few characters that must survive. Everything else is encoded,
 * because a vendor settings field is not validated as an email anywhere on the
 * way here and a stray `?` or `&` in it would otherwise start the query string
 * early and swallow the subject.
 */
function encodeAddress(contact: string): string {
  return encodeURIComponent(contact.trim()).replace(/%40/g, "@")
}

/**
 * `URLSearchParams` serialises a space as `+`, which is correct for a form post
 * and wrong here: a mail client reads the query of a `mailto:` literally, so the
 * subject line arrives as "Newsletter+signup".
 */
function percentEncodeSpaces(query: string): string {
  return query.replace(/\+/g, "%20")
}
