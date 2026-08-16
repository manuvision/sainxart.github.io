const copyButton = document.querySelector("#copyButton");
const copyButtonLabel = document.querySelector("#copyButtonLabel");
const copyStatus = document.querySelector("#copyStatus");
const promptPreview = document.querySelector("#promptPreview");

let promptText = "";
let resetTimer;

function setStatus(message) {
  copyStatus.textContent = message;
}

function countLines(text) {
  return text.replace(/\n$/, "").split("\n").length;
}

function fallbackCopy(text) {
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

async function copyPrompt() {
  if (!promptText) {
    return;
  }

  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(promptText);
    } else {
      fallbackCopy(promptText);
    }

    window.clearTimeout(resetTimer);
    copyButton.classList.add("is-copied");
    copyButtonLabel.textContent = "Prompt copied";
    setStatus("Copied in full — ready to paste");
    navigator.vibrate?.(25);

    resetTimer = window.setTimeout(() => {
      copyButton.classList.remove("is-copied");
      copyButtonLabel.textContent = "Copy full prompt";
      setStatus(`${countLines(promptText)} lines · Markdown formatting preserved`);
    }, 2200);
  } catch (error) {
    console.error("Could not copy the Glyxel prompt.", error);
    setStatus("Copy failed — open the preview and select the text manually");
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
    copyButton.disabled = false;
    copyButtonLabel.textContent = "Copy full prompt";
    setStatus(`${countLines(promptText)} lines · Markdown formatting preserved`);
  } catch (error) {
    console.error("Could not load the Glyxel prompt.", error);
    promptPreview.textContent = "The prompt could not be loaded. Please refresh this page.";
    copyButtonLabel.textContent = "Prompt unavailable";
    setStatus("Could not load the prompt — please refresh");
  }
}

copyButton.addEventListener("click", copyPrompt);
loadPrompt();
