import { browser } from "$app/environment";

// ── Chassis note (2026-07-20 ModalShell rollout) ─────────────────────────
// This service + the app.css `dialog.modal` system IS ZipList's equivalent
// of the softstack-charms ModalShell: one central place already owns the
// scroll-lock (position:fixed, scroll-restoring — stronger than an overflow
// lock), the exit animation orchestration (zl-modal-closing), one-modal-at-
// a-time switching, and a force-unlock safety net; Escape + focus containment
// come free from native <dialog>/showModal() top-layer semantics, which the
// div-based shell cannot provide. All five modals ride this one system with
// zero per-modal machinery, so vendoring the shell here would ADD a second
// parallel modal system — the exact drift disease the shell exists to kill.
// Deliberately not migrated. If this system ever grows per-modal copies,
// revisit softstack-charms/src/modal/ before hand-rolling anything.
// ─────────────────────────────────────────────────────────────────────────

// Keep in sync with the zl-modal-pop-out duration in app.css.
// Must match the zl-modal-pop-out duration in app.css (180ms). This is how
// long we wait before dialog.close() removes the element from the top layer.
const MODAL_CLOSE_DURATION = 180;

export class ModalService {
  constructor() {
    this.modalOpen = false;
    this.scrollPosition = 0;
    this.activeModal = null;
    this.isClosing = false;
    this.closeTimer = null;
    this.switchCloseInFlight = false;

    // Safety net: if ANY dialog closes and none remain open, restore page.
    // The per-open close listener can be orphaned (e.g. the dialog node is
    // replaced under us). `close` doesn't bubble, so listen in capture.
    if (browser) {
      document.addEventListener(
        "close",
        () => {
          if (this.isClosing) return; // closeModal() restores on its own timer
          if (!document.querySelector("dialog[open]")) {
            this.restorePage();
          } else {
            // A dialog closed while ANOTHER is open: a modal→modal switch.
            this.switchCloseInFlight = true;
            window.setTimeout(() => {
              this.switchCloseInFlight = false;
            }, 0);
          }
        },
        true,
      );
    }
  }

  openModal(modalId) {
    if (!browser) return;

    const modal = document.getElementById(modalId);
    if (!modal) return;

    if (this.modalOpen && this.activeModal === modal && modal.open) {
      return modal;
    }

    if (this.modalOpen && this.activeModal && this.activeModal !== modal) {
      this.closeModal();
    }

    // Clear any leftover closing state so the pop-in can run cleanly.
    modal.classList.remove("zl-modal-closing");

    this.scrollPosition = window.scrollY;
    this.modalOpen = true;
    this.activeModal = modal;

    // Scrollbar space is reserved permanently via `scrollbar-gutter: stable`
    // in app.css, so hiding overflow here no longer reflows the page or shifts
    // vertical register. No body position:fixed or scrollY resets needed.
    document.documentElement.style.overflow = "hidden";
    document.body?.classList.add("zl-modal-open");

    // Show the modal
    if (typeof modal.showModal === "function" && !modal.open) {
      modal.showModal();
    }

    return modal;
  }

  closeModal() {
    if (!browser || this.isClosing || this.switchCloseInFlight) return;

    const openDialogs = Array.from(document.querySelectorAll("dialog[open]"));
    if (!this.modalOpen && openDialogs.length === 0) return;

    this.isClosing = true;

    // Add the closing class so the pop-out animation runs, then
    // close (and unlock scroll) after it finishes.
    openDialogs.forEach((dialog) => dialog.classList.add("zl-modal-closing"));

    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const closeDelay = reduceMotion ? 0 : MODAL_CLOSE_DURATION;

    this.closeTimer = window.setTimeout(() => {
      this.closeTimer = null;

      openDialogs.forEach((dialog) => {
        if (dialog && typeof dialog.close === "function" && dialog.open) {
          dialog.close();
        }
        // Deliberately KEEP .zl-modal-closing here. DaisyUI's .modal fades
        // out via a ~200ms opacity transition after close(); stripping the
        // class now snaps .modal-box back to full opacity mid-fade.
        // openModal() (and cleanup()) already clear the class before the next showModal().
      });

      // A modal→modal switch may have opened a new dialog while this close
      // was animating — if so, the lock still belongs to it. Only release
      // when nothing is left open.
      if (!document.querySelector("dialog[open]")) {
        this.restorePage();
      }
      this.isClosing = false;
    }, closeDelay);
  }

  cleanup() {
    if (!browser) return;

    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    this.isClosing = false;

    document.querySelectorAll("dialog[open]").forEach((dialog) => {
      dialog.classList.remove("zl-modal-closing");
      if (dialog && typeof dialog.close === "function") {
        dialog.close();
      }
    });

    this.restorePage();
  }

  restorePage() {
    if (!browser) return;

    document.documentElement.style.overflow = "";
    document.body?.classList.remove("zl-modal-open");
    this.modalOpen = false;
    this.activeModal = null;
  }

  unlockScroll() {
    this.restorePage();
  }

  isModalOpen() {
    return this.modalOpen;
  }
}

export const modalService = new ModalService();
