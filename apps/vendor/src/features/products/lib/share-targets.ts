/**
 * The Share popover's outbound links, built from a product's storefront URL
 * and its title. Pure so the encoding can be pinned in a unit test: every
 * value goes through `encodeURIComponent`, because a title with `&` or `#`
 * dropped raw into a query string ends the parameter early and the network
 * receives half a link.
 *
 * It carries no label: `id` is the message key the Share popover looks up
 * (`products.header.shareTargets.*`), so the network names stay out of a
 * module that would otherwise have to be handed a translator to build a URL.
 *
 * `newTab` is false for email alone. A `mailto:` opened with
 * `target="_blank"` hands the browser a blank tab that stays open after the
 * mail client has launched; in the current tab it launches the client and
 * leaves the editor exactly where it was.
 */
export interface ShareTarget {
  id: "whatsapp" | "x" | "facebook" | "email"
  href: string
  newTab: boolean
}

export function shareTargets(title: string, url: string): ShareTarget[] {
  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  return [
    {
      id: "whatsapp",
      // One `text` carrying both: wa.me has no separate url parameter.
      href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
      newTab: true,
    },
    {
      id: "x",
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      newTab: true,
    },
    {
      id: "facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      newTab: true,
    },
    {
      id: "email",
      href: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`,
      newTab: false,
    },
  ]
}
