import type { IconType } from "react-icons"
import {
  BsFileEarmark,
  BsFileEarmarkFont,
  BsFileEarmarkZip,
  BsFiletypeAac,
  BsFiletypeAi,
  BsFiletypeBmp,
  BsFiletypeCss,
  BsFiletypeCsv,
  BsFiletypeDoc,
  BsFiletypeDocx,
  BsFiletypeGif,
  BsFiletypeHeic,
  BsFiletypeHtml,
  BsFiletypeJpg,
  BsFiletypeJs,
  BsFiletypeJson,
  BsFiletypeMd,
  BsFiletypeMov,
  BsFiletypeMp3,
  BsFiletypeMp4,
  BsFiletypePdf,
  BsFiletypePng,
  BsFiletypePpt,
  BsFiletypePptx,
  BsFiletypePsd,
  BsFiletypeRaw,
  BsFiletypeSvg,
  BsFiletypeTiff,
  BsFiletypeTxt,
  BsFiletypeWav,
  BsFiletypeXls,
  BsFiletypeXlsx,
  BsFiletypeXml,
} from "react-icons/bs"

/**
 * Colour families for file-type glyphs. One tone per *category* rather than
 * per extension, so DOCX and DOC read as the same kind of thing at a glance.
 * Every tone carries a dark-mode pair — the tinted chip sits on `bg-muted` in
 * light and on the card surface in dark, and both need the same contrast.
 */
export type FileTone = {
  /** Glyph colour. */
  fg: string
  /** Tint behind the glyph. */
  bg: string
}

const TONES = {
  image: { fg: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10" },
  video: { fg: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10" },
  audio: { fg: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
  pdf: { fg: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
  doc: { fg: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
  sheet: { fg: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  slides: { fg: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10" },
  archive: { fg: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10" },
  code: { fg: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10" },
  font: { fg: "text-fuchsia-600 dark:text-fuchsia-400", bg: "bg-fuchsia-500/10" },
  generic: { fg: "text-muted-foreground", bg: "bg-muted" },
} satisfies Record<string, FileTone>

type ToneName = keyof typeof TONES

/**
 * Exact MIME → glyph. Bootstrap's set has no WEBP/AVIF/WEBM/OGG glyph, so
 * those fall through to the prefix rules below and borrow the family icon
 * (PNG for raster images, MOV for video) while keeping the right tone.
 */
const BY_MIME: Record<string, [IconType, ToneName]> = {
  "image/jpeg": [BsFiletypeJpg, "image"],
  "image/png": [BsFiletypePng, "image"],
  "image/gif": [BsFiletypeGif, "image"],
  "image/svg+xml": [BsFiletypeSvg, "image"],
  "image/bmp": [BsFiletypeBmp, "image"],
  "image/tiff": [BsFiletypeTiff, "image"],
  "image/heic": [BsFiletypeHeic, "image"],
  "image/heif": [BsFiletypeHeic, "image"],
  "image/x-adobe-dng": [BsFiletypeRaw, "image"],
  "image/vnd.adobe.photoshop": [BsFiletypePsd, "image"],
  "application/postscript": [BsFiletypeAi, "image"],

  "video/mp4": [BsFiletypeMp4, "video"],
  "video/quicktime": [BsFiletypeMov, "video"],

  "audio/mpeg": [BsFiletypeMp3, "audio"],
  "audio/wav": [BsFiletypeWav, "audio"],
  "audio/x-wav": [BsFiletypeWav, "audio"],
  "audio/aac": [BsFiletypeAac, "audio"],

  "application/pdf": [BsFiletypePdf, "pdf"],
  "application/msword": [BsFiletypeDoc, "doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    BsFiletypeDocx,
    "doc",
  ],
  "application/vnd.ms-excel": [BsFiletypeXls, "sheet"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    BsFiletypeXlsx,
    "sheet",
  ],
  "text/csv": [BsFiletypeCsv, "sheet"],
  "application/vnd.ms-powerpoint": [BsFiletypePpt, "slides"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    BsFiletypePptx,
    "slides",
  ],

  "application/zip": [BsFileEarmarkZip, "archive"],
  "application/x-zip-compressed": [BsFileEarmarkZip, "archive"],
  "application/gzip": [BsFileEarmarkZip, "archive"],
  "application/x-7z-compressed": [BsFileEarmarkZip, "archive"],
  "application/vnd.rar": [BsFileEarmarkZip, "archive"],

  "text/plain": [BsFiletypeTxt, "generic"],
  "text/markdown": [BsFiletypeMd, "generic"],
  "text/html": [BsFiletypeHtml, "code"],
  "text/css": [BsFiletypeCss, "code"],
  "text/javascript": [BsFiletypeJs, "code"],
  "application/javascript": [BsFiletypeJs, "code"],
  "application/json": [BsFiletypeJson, "code"],
  "application/xml": [BsFiletypeXml, "code"],
  "text/xml": [BsFiletypeXml, "code"],

  "font/woff": [BsFileEarmarkFont, "font"],
  "font/woff2": [BsFileEarmarkFont, "font"],
  "font/ttf": [BsFileEarmarkFont, "font"],
  "font/otf": [BsFileEarmarkFont, "font"],
}

/** Family fallbacks for MIME types the exact table doesn't name. */
const BY_PREFIX: [string, IconType, ToneName][] = [
  ["image/", BsFiletypePng, "image"],
  ["video/", BsFiletypeMov, "video"],
  ["audio/", BsFiletypeMp3, "audio"],
  ["font/", BsFileEarmarkFont, "font"],
  ["text/", BsFiletypeTxt, "generic"],
]

/**
 * The glyph + tone for a MIME type. Never throws and never returns null —
 * an unknown type gets the neutral generic file icon, so a row always renders.
 */
export function fileTypeIcon(mime: string): { Icon: IconType; tone: FileTone } {
  const exact = BY_MIME[mime]
  if (exact) return { Icon: exact[0], tone: TONES[exact[1]] }

  const prefixed = BY_PREFIX.find(([prefix]) => mime.startsWith(prefix))
  if (prefixed) return { Icon: prefixed[1], tone: TONES[prefixed[2]] }

  return { Icon: BsFileEarmark, tone: TONES.generic }
}
