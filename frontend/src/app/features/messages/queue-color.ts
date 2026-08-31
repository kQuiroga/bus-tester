/**
 * Deterministic queue-name → palette-slot mapping for the tinted queue pill and dot
 * (ui-presentation: "Queues Are Identified by a Tinted Pill and Dot").
 *
 * Design D5: an FNV-1a 32-bit hash over the name's UTF-16 code units, folded into six
 * token slots (`--color-queue-1` … `--color-queue-6`). Chosen over insertion order
 * (colours jump on unsubscribe/resubscribe) and over `h * 31 + c` (poor low-bit
 * dispersion mod 6). Collisions are accepted — six slots identify queues at a glance,
 * they are not a uniqueness guarantee.
 */

/** One of the six queue palette slots. */
export type QueueColor = 1 | 2 | 3 | 4 | 5 | 6;

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const PALETTE_SLOTS = 6;

/**
 * Maps a queue name to a stable palette slot in `1..6`.
 *
 * `Math.imul` keeps every multiply step in int32 — a plain `*` loses integer precision
 * past 2^53, which would push long names out of range.
 */
export function queueColorIndex(queueName: string): QueueColor {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < queueName.length; i++) {
    hash ^= queueName.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (((hash >>> 0) % PALETTE_SLOTS) + 1) as QueueColor;
}
