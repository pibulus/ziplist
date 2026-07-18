import { browser } from "$app/environment";

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

    // Safety net: if ANY dialog closes and none remain open, force-unlock.
    // The per-open close listener can be orphaned (e.g. the dialog node is
    // replaced under us); without this the body stays position:fixed and the
    // page is frozen forever. `close` doesn't bubble, so listen in capture.
    if (browser) {
      document.addEventListener(
        "close",
        () => {
          if (this.isClosing) return; // closeModal() unlocks on its own timer
          if (!document.querySelector("dialog[open]")) {
            this.unlockScroll({ force: true });
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

    // Lock body scroll — but only take a fresh snapshot when we're the
    // first lock. On modal→modal switches the body is already fixed, so
    // window.scrollY would read 0 and clobber the user's real position.
    if (!this.modalOpen) {
      this.scrollPosition = window.scrollY;
      const width = document.body.clientWidth;
      document.documentElement.classList.add("modal-active");
      document.body.classList.add("modal-active");
      document.body.style.position = "fixed";
      document.body.style.top = `-${this.scrollPosition}px`;
      document.body.style.width = `${width}px`;
      document.body.style.overflow = "hidden";
    }

    this.modalOpen = true;
    this.activeModal = modal;

    // Unlocking is handled by the document-level capture listener in the
    // constructor — it survives node replacement and modal switches.

    // Show the modal
    if (typeof modal.showModal === "function" && !modal.open) {
      modal.showModal();
    }

    return modal;
  }

  closeModal() {
    if (!browser || this.isClosing) return;

    const openDialogs = Array.from(document.querySelectorAll("dialog[open]"));
    if (!this.modalOpen && openDialogs.length === 0) return;

    this.isClosing = true;

    // Add the closing class so the pop-out animation runs, then
    // close (and unlock scroll) after it finishes. This is the skeleton's
    // #1 win — modals animate OUT instead of vanishing.
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
        dialog.classList.remove("zl-modal-closing");
      });

      // A modal→modal switch may have opened a new dialog while this close
      // was animating — if so, the lock still belongs to it. Only release
      // when nothing is left open.
      if (!document.querySelector("dialog[open]")) {
        this.unlockScroll({ force: true });
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

    this.unlockScroll({ force: true });
  }

  unlockScroll({ force = false } = {}) {
    // `force` also covers desync repair: body locked but modalOpen already
    // false (orphaned state). Without force, only unlock a lock we own.
    if (!browser || (!this.modalOpen && !force)) return;

    // Restore body styles
    document.documentElement.classList.remove("modal-active");
    document.body.classList.remove("modal-active");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    document.body.style.overflow = "";
    document.body.style.height = "";

    // Restore scroll position
    window.scrollTo(0, this.scrollPosition || 0);

    this.modalOpen = false;
    this.activeModal = null;
  }

  isModalOpen() {
    return this.modalOpen;
  }
}

export const modalService = new ModalService();
