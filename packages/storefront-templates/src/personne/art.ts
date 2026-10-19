import a_hanger_webp from "./art/hanger.webp"
import a_hanger_480_webp from "./art/hanger-480.webp"
import a_lining_webp from "./art/lining.webp"
import a_table_webp from "./art/table.webp"
import a_canvas_webp from "./art/canvas.webp"
import a_canvas_1200_webp from "./art/canvas-1200.webp"
import a_buttonhole_webp from "./art/buttonhole.webp"
import a_buttonhole_1200_webp from "./art/buttonhole-1200.webp"
import a_p01_flath_webp from "./art/p01-flath.webp"
import a_p01_flat_webp from "./art/p01-flat.webp"
import a_p01_ghost_webp from "./art/p01-ghost.webp"
import a_sdf01_png from "./art/sdf01.png"
import a_p02_flat_webp from "./art/p02-flat.webp"
import a_p02_ghost_webp from "./art/p02-ghost.webp"
import a_p03_flat_webp from "./art/p03-flat.webp"
import a_p03_ghost_webp from "./art/p03-ghost.webp"
import a_p04_flat_webp from "./art/p04-flat.webp"
import a_p04_ghost_webp from "./art/p04-ghost.webp"
import a_p05_flat_webp from "./art/p05-flat.webp"
import a_p05_ghost_webp from "./art/p05-ghost.webp"
import a_p06_flat_webp from "./art/p06-flat.webp"
import a_p06_ghost_webp from "./art/p06-ghost.webp"
import a_m_p01_flat_webp from "./art/m-p01-flat.webp"
import a_m_p01_ghost_webp from "./art/m-p01-ghost.webp"
import a_m_p02_flat_webp from "./art/m-p02-flat.webp"
import a_m_p02_ghost_webp from "./art/m-p02-ghost.webp"
import a_m_p03_flat_webp from "./art/m-p03-flat.webp"
import a_m_p03_ghost_webp from "./art/m-p03-ghost.webp"
import a_m_p04_flat_webp from "./art/m-p04-flat.webp"
import a_m_p04_ghost_webp from "./art/m-p04-ghost.webp"
import a_m_p05_flat_webp from "./art/m-p05-flat.webp"
import a_m_p05_ghost_webp from "./art/m-p05-ghost.webp"
import a_m_p06_flat_webp from "./art/m-p06-flat.webp"
import a_m_p06_ghost_webp from "./art/m-p06-ghost.webp"

const files: Record<string, { src: string }> = {
  "hanger.webp": a_hanger_webp,
  "hanger-480.webp": a_hanger_480_webp,
  "lining.webp": a_lining_webp,
  "table.webp": a_table_webp,
  "canvas.webp": a_canvas_webp,
  "canvas-1200.webp": a_canvas_1200_webp,
  "buttonhole.webp": a_buttonhole_webp,
  "buttonhole-1200.webp": a_buttonhole_1200_webp,
  "p01-flath.webp": a_p01_flath_webp,
  "p01-flat.webp": a_p01_flat_webp,
  "p01-ghost.webp": a_p01_ghost_webp,
  "sdf01.png": a_sdf01_png,
  "p02-flat.webp": a_p02_flat_webp,
  "p02-ghost.webp": a_p02_ghost_webp,
  "p03-flat.webp": a_p03_flat_webp,
  "p03-ghost.webp": a_p03_ghost_webp,
  "p04-flat.webp": a_p04_flat_webp,
  "p04-ghost.webp": a_p04_ghost_webp,
  "p05-flat.webp": a_p05_flat_webp,
  "p05-ghost.webp": a_p05_ghost_webp,
  "p06-flat.webp": a_p06_flat_webp,
  "p06-ghost.webp": a_p06_ghost_webp,
  "m/p01-flat.webp": a_m_p01_flat_webp,
  "m/p01-ghost.webp": a_m_p01_ghost_webp,
  "m/p02-flat.webp": a_m_p02_flat_webp,
  "m/p02-ghost.webp": a_m_p02_ghost_webp,
  "m/p03-flat.webp": a_m_p03_flat_webp,
  "m/p03-ghost.webp": a_m_p03_ghost_webp,
  "m/p04-flat.webp": a_m_p04_flat_webp,
  "m/p04-ghost.webp": a_m_p04_ghost_webp,
  "m/p05-flat.webp": a_m_p05_flat_webp,
  "m/p05-ghost.webp": a_m_p05_ghost_webp,
  "m/p06-flat.webp": a_m_p06_flat_webp,
  "m/p06-ghost.webp": a_m_p06_ghost_webp,
}

/** Bundled still. A mobile copy falls back to the full file when it was not published. */
export function personneArt(name: string): string {
  const key = name.split("?")[0].replace(/^img\//, "")
  return (files[key] ?? files[key.replace(/^m\//, "")])?.src ?? ""
}
