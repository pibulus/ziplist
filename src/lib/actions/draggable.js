/**
 * Draggable Action
 * Svelte action for drag and drop functionality
 */

import { hapticService } from "$lib/services/infrastructure/hapticService";

/**
 * Makes an element draggable with callbacks
 * @param {HTMLElement} node - The element to make draggable
 * @param {Object} options - Configuration options
 * @param {Function} options.onDragStart - Called when drag starts
 * @param {Function} options.onDragEnd - Called when drag ends
 * @param {Function} options.onDragOver - Called when dragging over
 * @param {Function} options.onDrop - Called when dropped
 * @param {boolean} options.disabled - Whether dragging is disabled
 */
export function draggable(node, options = {}) {
  let {
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
    disabled = false,
  } = options;

  function handleDragStart(event) {
    if (disabled) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    hapticService.dragStart();

    if (onDragStart) {
      onDragStart(event);
    }
  }

  function handleDragEnd(event) {
    hapticService.dragEnd();

    if (onDragEnd) {
      onDragEnd(event);
    }
  }

  function handleDragOver(event) {
    if (disabled) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (onDragOver) {
      onDragOver(event);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    hapticService.impact("heavy");

    if (onDrop) {
      onDrop(event);
    }
  }

  // Set draggable attribute
  node.setAttribute("draggable", !disabled);

  // Add event listeners
  node.addEventListener("dragstart", handleDragStart);
  node.addEventListener("dragend", handleDragEnd);
  node.addEventListener("dragover", handleDragOver);
  node.addEventListener("drop", handleDrop);

  return {
    update(newOptions) {
      ({
        onDragStart,
        onDragEnd,
        onDragOver,
        onDrop,
        disabled = false,
      } = newOptions);
      node.setAttribute("draggable", !disabled);
    },
    destroy() {
      node.removeEventListener("dragstart", handleDragStart);
      node.removeEventListener("dragend", handleDragEnd);
      node.removeEventListener("dragover", handleDragOver);
      node.removeEventListener("drop", handleDrop);
    },
  };
}
