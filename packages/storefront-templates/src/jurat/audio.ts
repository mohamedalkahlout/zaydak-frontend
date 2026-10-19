import aud_pluck_c3 from "./audio/pluck-c3.mp3"
import aud_pluck_d3 from "./audio/pluck-d3.mp3"
import aud_pluck_d3s from "./audio/pluck-d3s.mp3"
import aud_pluck_e3 from "./audio/pluck-e3.mp3"
import aud_pluck_g3 from "./audio/pluck-g3.mp3"
import aud_pluck_d5 from "./audio/pluck-d5.mp3"
import aud_ring from "./audio/ring.mp3"
import aud_phrase from "./audio/phrase.mp3"
import aud_knock from "./audio/knock.mp3"
import aud_tap from "./audio/tap.mp3"
import aud_crack from "./audio/crack.mp3"
import aud_switch from "./audio/switch.mp3"
import aud_swish from "./audio/swish.mp3"

const files: Record<string, string> = {
  "pluck-c3": aud_pluck_c3,
  "pluck-d3": aud_pluck_d3,
  "pluck-d3s": aud_pluck_d3s,
  "pluck-e3": aud_pluck_e3,
  "pluck-g3": aud_pluck_g3,
  "pluck-d5": aud_pluck_d5,
  "ring": aud_ring,
  "phrase": aud_phrase,
  "knock": aud_knock,
  "tap": aud_tap,
  "crack": aud_crack,
  "switch": aud_switch,
  "swish": aud_swish,
}

export function juratAudio(name: string): string {
  return files[name] ?? ""
}
