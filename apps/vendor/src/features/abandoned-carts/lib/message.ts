import { MERGE_TAGS, type MergeTag } from "./constants"

export function substituteMergeTags(
  template: string,
  values: Partial<Record<MergeTag, string>>,
): string {
  return template.replace(/\{([a-z_]+)\}/gi, (match, key: string) => {
    const value = values[key.toLowerCase() as MergeTag]
    return value ? value : match
  })
}

export function insertMergeTag(template: string, tag: MergeTag): string {
  const token = `{${tag}}`
  if (template.includes(token)) return template
  const needsSpace = template.length > 0 && !/\s$/.test(template)
  return `${template}${needsSpace ? " " : ""}${token}`
}

export function defaultReminderTitle(locale: string): string {
  return locale === "ar" ? "طلبك في السلة ينتظرك" : "Your cart is waiting"
}

export function defaultReminderBody(
  locale: string,
  withDiscount = false,
): string {
  if (locale === "ar") {
    return withDiscount
      ? "هلا {name}، نحب نقدم لك خصم خاص {discount_amount} على سلة تسوقك لكن الخصم ينتهي في {date}. لا يفوتك!"
      : "هلا {name}، تركت منتجات في سلة {shop_name}. أكمل طلبك من هنا: {cart_url}"
  }
  return withDiscount
    ? "Hi {name}, here's a special {discount_amount} off your cart — it expires on {date}. Don't miss it!"
    : "Hi {name}, you left items in your {shop_name} cart. Finish your order here: {cart_url}"
}

export function samplePreviewValues(locale: string): Record<MergeTag, string> {
  if (locale === "ar") {
    return {
      name: "سارة",
      shop_name: "متجرك",
      cart_url: "https://shop.example/cart",
      discount_code: "CARTAB12",
      discount_amount: "10%",
      date: "24 سبتمبر 2026",
    }
  }
  return {
    name: "Ada",
    shop_name: "Your shop",
    cart_url: "https://shop.example/cart",
    discount_code: "CARTAB12",
    discount_amount: "10%",
    date: "24 Sep 2026",
  }
}

export { MERGE_TAGS }
export type { MergeTag }
