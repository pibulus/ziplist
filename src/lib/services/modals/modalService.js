import { browser } from "$app/environment";

export class ModalService {
  constructor() {
    this.modalOpen = false;
    this.scrollPosition = 0;
    this.activeModal = null;
    this.handleNativeClose = null;
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
    if (!browser || !this.modalOpen) return;

    this.detachNativeCloseHandler();

    // Close any open dialogs
    document.querySelectorAll("dialog[open]").forEach((dialog) => {
      if (dialog && typeof dialog.close === "function") {
        dialog.close();
      }
    });

    this.unlockScroll();
  }

  cleanup() {
    if (!browser) return;

    this.detachNativeCloseHandler();

    document.querySelectorAll("dialog[open]").forEach((dialog) => {
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
