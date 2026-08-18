const copyPromptButton = document.querySelector("#copyPromptButton");
const copyPromptButtonLabel = document.querySelector("#copyPromptButtonLabel");
const promptCopyStatus = document.querySelector("#promptCopyStatus");
const copyImageButton = document.querySelector("#copyImageButton");
const copyImageButtonLabel = document.querySelector("#copyImageButtonLabel");
const imageCopyStatus = document.querySelector("#imageCopyStatus");
const promptPreview = document.querySelector("#promptPreview");
const referenceImage = document.querySelector("#referenceImage");

let promptText = "";
let referenceImageBlob = null;
const resetTimers = new Map();

function countLines(text) {
  return text.replace(/\n$/, "").split("\n").length;
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.inset = "0 auto auto -9999px";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("Copy command was rejected.");
  }
}

function fallbackCopyImage() {
  const selection = window.getSelection();
  if (!selection || !referenceImage.complete) {
    return false;
  }

  const range = document.createRange();
  range.selectNode(referenceImage);
  selection.removeAllRanges();
  selection.addRange(range);
  const copied = document.execCommand("copy");
  selection.removeAllRanges();
  return copied;
}

function showCopiedState({ button, label, status, copiedLabel, readyLabel, readyStatus }) {
  window.clearTimeout(resetTimers.get(button));
  button.classList.add("is-copied");
  label.textContent = copiedLabel;
  status.textContent = "Copied — paste it into your creature chat now";
  navigator.vibrate?.(25);

  const timer = window.setTimeout(() => {
    button.classList.remove("is-copied");
    label.textContent = readyLabel;
    status.textContent = readyStatus;
  }, 2600);
  resetTimers.set(button, timer);
}

async function copyPrompt() {
  if (!promptText) {
    return;
  }

  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(promptText);
    } else {
      fallbackCopyText(promptText);
    }

    showCopiedState({
      button: copyPromptButton,
      label: copyPromptButtonLabel,
      status: promptCopyStatus,
      copiedLabel: "Prompt copied",
      readyLabel: "Copy master prompt",
      readyStatus: `${countLines(promptText)} lines · Markdown formatting preserved`,
    });
  } catch (error) {
    console.error("Could not copy the Glyxel prompt.", error);
    promptCopyStatus.textContent = "Copy failed — open the preview and select the text manually";
  }
}

async function copyReferenceImage() {
  if (!referenceImageBlob) {
    return;
  }

  try {
    const ClipboardItemConstructor = globalThis.ClipboardItem;
    const supportsClipboardImage = window.isSecureContext
      && navigator.clipboard?.write
      && ClipboardItemConstructor
      && (typeof ClipboardItemConstructor.supports !== "function"
        || ClipboardItemConstructor.supports("image/png"));

    if (supportsClipboardImage) {
      const imageItem = new ClipboardItemConstructor({ "image/png": referenceImageBlob });
      await navigator.clipboard.write([imageItem]);
    } else if (!fallbackCopyImage()) {
      throw new Error("This browser does not support copying images.");
    }

    showCopiedState({
      button: copyImageButton,
      label: copyImageButtonLabel,
      status: imageCopyStatus,
      copiedLabel: "Reference copied",
      readyLabel: "Copy reference image",
      readyStatus: "1034 × 1228 PNG · Ready to copy",
    });
  } catch (error) {
    console.error("Could not copy the Glyxel reference image.", error);
    imageCopyStatus.textContent = "Image copy is unavailable here — download it or long-press the image";
  }
}

async function loadPrompt() {
  try {
    const response = await fetch("prompt.txt", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Prompt request failed with ${response.status}.`);
    }

    promptText = await response.text();
    promptPreview.textContent = promptText;
    copyPromptButton.disabled = false;
    copyPromptButtonLabel.textContent = "Copy master prompt";
    promptCopyStatus.textContent = `${countLines(promptText)} lines · Markdown formatting preserved`;
  } catch (error) {
    console.error("Could not load the Glyxel prompt.", error);
    promptPreview.textContent = "The prompt could not be loaded. Please refresh this page.";
    copyPromptButtonLabel.textContent = "Prompt unavailable";
    promptCopyStatus.textContent = "Could not load the prompt — please refresh";
  }
}

async function loadReferenceImage() {
  try {
    const response = await fetch("reference-illustration.png");

    if (!response.ok) {
      throw new Error(`Reference image request failed with ${response.status}.`);
    }

    const blob = await response.blob();
    referenceImageBlob = blob.type === "image/png"
      ? blob
      : new Blob([await blob.arrayBuffer()], { type: "image/png" });
    copyImageButton.disabled = false;
    copyImageButtonLabel.textContent = "Copy reference image";
    imageCopyStatus.textContent = "1034 × 1228 PNG · Ready to copy";
  } catch (error) {
    console.error("Could not load the Glyxel reference image.", error);
    copyImageButtonLabel.textContent = "Image unavailable";
    imageCopyStatus.textContent = "Could not load the reference image — please refresh";
  }
}

copyPromptButton.addEventListener("click", copyPrompt);
copyImageButton.addEventListener("click", copyReferenceImage);
loadPrompt();
loadReferenceImage();
