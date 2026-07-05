import { browser } from "$app/environment";

// Keep in sync with the zl-modal-pop-out / sheet-out durations in app.css.
const MODAL_CLOSE_DURATION = 220;

export class ModalService {
  constructor() {
    this.modalOpen = false;
    this.scrollPosition = 0;
    this.activeModal = null;
    this.handleNativeClose = null;
    this.isClosing = false;
    this.closeTimer = null;
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

    // Save scroll position and lock body
    this.scrollPosition = window.scrollY;
    const width = document.body.clientWidth;
    this.modalOpen = true;
    this.activeModal = modal;

    document.documentElement.classList.add("modal-active");
    document.body.classList.add("modal-active");
    document.body.style.position = "fixed";
    document.body.style.top = `-${this.scrollPosition}px`;
    document.body.style.width = `${width}px`;
    document.body.style.overflow = "hidden";

    this.handleNativeClose = () => {
      this.unlockScroll();
    };
    modal.addEventListener("close", this.handleNativeClose, { once: true });

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

    // Add the closing class so the pop-out / sheet-out animation runs, then
    // close (and unlock scroll) after it finishes. This is the skeleton's
    // #1 win — modals animate OUT instead of vanishing.
    openDialogs.forEach((dialog) => dialog.classList.add("zl-modal-closing"));

    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const closeDelay = reduceMotion ? 0 : MODAL_CLOSE_DURATION;

    this.closeTimer = window.setTimeout(() => {
      this.closeTimer = null;
      this.detachNativeCloseHandler();

      openDialogs.forEach((dialog) => {
        if (dialog && typeof dialog.close === "function" && dialog.open) {
          dialog.close();
        }
        dialog.classList.remove("zl-modal-closing");
      });

      this.unlockScroll();
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

    this.detachNativeCloseHandler();

    document.querySelectorAll("dialog[open]").forEach((dialog) => {
      dialog.classList.remove("zl-modal-closing");
      if (dialog && typeof dialog.close === "function") {
        dialog.close();
      }
    });

    this.unlockScroll({ force: true });
  }

  detachNativeCloseHandler() {
    if (this.activeModal && this.handleNativeClose) {
      this.activeModal.removeEventListener("close", this.handleNativeClose);
    }
    this.handleNativeClose = null;
  }

  unlockScroll({ force = false } = {}) {
    if (!browser || (!this.modalOpen && !force)) return;

    this.detachNativeCloseHandler();

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
