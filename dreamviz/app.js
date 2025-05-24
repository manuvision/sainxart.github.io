async function generateDreamImage() {
  const img = document.getElementById("dream-image");
  const loader = document.getElementById("loader");
  const button = document.querySelector("button[onclick='generateDreamImage()']");
  const captionEl = document.getElementById("dream-caption");

  img.src = "";
  img.alt = "";
  loader.style.display = "block";
  button.disabled = true;
  button.textContent = "Generating...";

  try {
    const response = await fetch("https://dreamviz-backend.onrender.com/generate-image");
    const data = await response.json();

    if (!data.base64) throw new Error("No image data returned");

    const timestamp = data.timestamp ?? new Date().toISOString();
    captionEl.textContent = `${data.caption} (${new Date(timestamp).toLocaleString()})`;

    img.src = `data:image/png;base64,${data.base64}`;
    img.alt = "Your dream image";

    renderDreamGallery();

  } catch (err) {
    console.error(err);
    img.alt = "Failed to load image.";
    captionEl.textContent = "";
  } finally {
    loader.style.display = "none";
    button.disabled = false;
    button.textContent = "Generate Dream Image";
  }
}

async function renderDreamGallery(dateOverride = null) {
  const date = dateOverride ?? new Date().toLocaleDateString("sv-SE", { timeZone: "America/Toronto" });

  const res = await fetch(`https://dreamviz-backend.onrender.com/fetch-dreams?date=${date}`);
  const data = await res.json();

  const container = document.getElementById("gallery");
  container.innerHTML = "";

  if (!Array.isArray(data) || data.length === 0) {
    container.innerHTML = "<p>No dreams found for this date.</p>";
    return;
  }

  data.forEach(dream => {
    const thumb = document.createElement("img");
    thumb.src = dream.image_base64;
    thumb.alt = dream.timestamp;
    thumb.title = dream.timestamp;
    thumb.onclick = () => {
      const img = document.getElementById("dream-image");
      const captionEl = document.getElementById("dream-caption");
      img.src = dream.image_base64;
      img.alt = `Dream from ${dream.timestamp}`;
      captionEl.textContent = `${dream.caption} (${new Date(dream.timestamp).toLocaleString()})`;

      document.getElementById("sleep-card").innerHTML = `
        <h2>Sleep Score: ${dream.scores_json.sleep ?? 'N/A'}</h2>
      `;
      document.getElementById("readiness-card").innerHTML = `
        <h2>Readiness Score: ${dream.scores_json.readiness ?? 'N/A'}</h2>
      `;
      document.getElementById("activity-card").innerHTML = `
        <h2>Activity Score: ${dream.scores_json.activity ?? 'N/A'}</h2>
      `;
    };
    container.appendChild(thumb);
  });
}

async function loadDreamByDate() {
  const date = document.getElementById("date-picker").value;
  if (!date) return;

  renderDreamGallery(date);
}

document.addEventListener("DOMContentLoaded", () => {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Toronto" });
  document.getElementById("date-picker").value = today;
  loadDreamByDate();
});
