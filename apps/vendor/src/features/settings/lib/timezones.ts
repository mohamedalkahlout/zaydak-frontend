export interface TimezoneOption {
  value: string
  labelEn: string
  labelAr: string
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  {
    value: "Asia/Riyadh",
    labelEn: "(GMT+03:00) Riyadh, Saudi Arabia",
    labelAr: "(GMT+03:00) الرياض، السعودية",
  },
  {
    value: "Asia/Dubai",
    labelEn: "(GMT+04:00) Dubai, UAE",
    labelAr: "(GMT+04:00) دبي، الإمارات",
  },
  {
    value: "Africa/Cairo",
    labelEn: "(GMT+02:00) Cairo, Egypt",
    labelAr: "(GMT+02:00) القاهرة، مصر",
  },
  {
    value: "Asia/Kuwait",
    labelEn: "(GMT+03:00) Kuwait",
    labelAr: "(GMT+03:00) الكويت",
  },
  {
    value: "Asia/Qatar",
    labelEn: "(GMT+03:00) Qatar",
    labelAr: "(GMT+03:00) قطر",
  },
  {
    value: "Asia/Bahrain",
    labelEn: "(GMT+03:00) Bahrain",
    labelAr: "(GMT+03:00) البحرين",
  },
  {
    value: "Asia/Muscat",
    labelEn: "(GMT+04:00) Muscat, Oman",
    labelAr: "(GMT+04:00) مسقط، عمان",
  },
  {
    value: "Asia/Amman",
    labelEn: "(GMT+03:00) Amman, Jordan",
    labelAr: "(GMT+03:00) عمّان، الأردن",
  },
  {
    value: "Asia/Gaza",
    labelEn: "(GMT+03:00) Palestine / Gaza",
    labelAr: "(GMT+03:00) فلسطين / غزة",
  },
  {
    value: "Asia/Baghdad",
    labelEn: "(GMT+03:00) Baghdad, Iraq",
    labelAr: "(GMT+03:00) بغداد، العراق",
  },
  {
    value: "Asia/Aden",
    labelEn: "(GMT+03:00) Aden, Yemen",
    labelAr: "(GMT+03:00) عدن، اليمن",
  },
  {
    value: "UTC",
    labelEn: "(GMT+00:00) UTC",
    labelAr: "(GMT+00:00) التوقيت العالمي المنسق",
  },
  {
    value: "Europe/London",
    labelEn: "(GMT+00:00) London",
    labelAr: "(GMT+00:00) لندن",
  },
  {
    value: "Europe/Paris",
    labelEn: "(GMT+01:00) Paris",
    labelAr: "(GMT+01:00) باريس",
  },
  {
    value: "Europe/Istanbul",
    labelEn: "(GMT+03:00) Istanbul",
    labelAr: "(GMT+03:00) إسطنبول",
  },
  {
    value: "America/New_York",
    labelEn: "(GMT-05:00) New York (Eastern Time)",
    labelAr: "(GMT-05:00) نيويورك (التوقيت الشرقي)",
  },
  {
    value: "America/Los_Angeles",
    labelEn: "(GMT-08:00) Los Angeles (Pacific Time)",
    labelAr: "(GMT-08:00) لوس أنجلوس (توقيت المحيط الهادئ)",
  },
]

export function getTimezoneLabel(tz: string, locale: string): string {
  const found = TIMEZONE_OPTIONS.find((o) => o.value === tz)
  if (found) {
    return locale === "ar" ? found.labelAr : found.labelEn
  }
  return tz
}
