import { create } from "zustand"

/**
 * Whether the cart drawer is showing.
 *
 * A store rather than state inside the header, because the things that open the
 * drawer are nowhere near the thing that renders it: a `QuickAddButton` on a
 * catalogue tile, the buy bar on a product page, and the bag button in the
 * header itself. Threading a callback down to a product grid would make every
 * component between them take a prop it does not use.
 */

/**
 * The id of an open that has been asked for but has not happened yet.
 *
 * It lives here, beside the state it will change, rather than in the component
 * that asked — and that is a fix, not a preference. `useAddToCartGesture` used
 * to hold it in a ref and clear it on unmount, which meant the confirmation a
 * shopper had already asked for belonged to the *tile they pressed*: anything
 * that replaced the grid inside the delay cancelled the drawer silently, with
 * no error and no second chance. `ProductGrid` swaps every tile for skeletons
 * on any filter, sort or page change, so that was an ordinary action, and it is
 * why the header's bag button — which opens with no delay and so has nothing to
 * lose — kept working while the tiles looked dead.
 *
 * There is exactly one drawer per document (mounted once by `ShopShell`), so
 * there is exactly one pending open to hold.
 */
let pendingOpen: number | null = null

function cancelPendingOpen() {
  if (pendingOpen === null) return
  window.clearTimeout(pendingOpen)
  pendingOpen = null
}

/**
 * Which surface the bag opens onto.
 *
 * `drawer` is the inset sheet that slides in from the page edge; `panel` is the
 * bag hanging straight off the header button. They are two skins over one state
 * — the same `open` flag, the same `useCart`, the same delayed open the add
 * gesture asks for — so switching is a single field and nothing that opens the
 * cart has to know which one is mounted.
 *
 * It lives in the store rather than in a prop for the same reason `open` does:
 * the thing that renders the drawer (`ShopShell`) and the thing that renders
 * the panel (the header's bag button) are in different subtrees, and both have
 * to agree on the answer or the cart is either mounted twice or not at all.
 */
export type CartSurface = "drawer" | "panel"

interface CartDrawerState {
  open: boolean
  surface: CartSurface
  setSurface: (surface: CartSurface) => void
  setOpen: (open: boolean) => void
  openDrawer: () => void
  /**
   * Open once `ms` has passed — used to let an add-to-cart flight land before
   * the panel covers the corner it is flying to. See `useAddToCartGesture`.
   */
  openDrawerAfter: (ms: number) => void
  closeDrawer: () => void
}

export const useCartDrawerStore = create<CartDrawerState>((set) => ({
  open: false,
  surface: "panel",

  // Changing surface closes whatever is showing. The two are mounted in
  // different subtrees, so swapping while open would unmount one mid-animation
  // and mount the other already open, with no transition and no anchor
  // measurement behind it.
  setSurface: (surface) => {
    cancelPendingOpen()
    set({ surface, open: false })
  },

  // Every one of these cancels a pending open first, so the last instruction
  // wins. Without it a dismissal inside the delay is undone a moment later by a
  // timer the shopper cannot see: close the drawer after adding something and
  // it reopens on its own.
  setOpen: (open) => {
    cancelPendingOpen()
    set({ open })
  },
  openDrawer: () => {
    cancelPendingOpen()
    set({ open: true })
  },
  openDrawerAfter: (ms) => {
    cancelPendingOpen()
    pendingOpen = window.setTimeout(() => {
      pendingOpen = null
      set({ open: true })
    }, ms)
  },
  closeDrawer: () => {
    cancelPendingOpen()
    set({ open: false })
  },
}))
