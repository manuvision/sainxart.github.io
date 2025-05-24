const token = "23YGF6YEKBOFNFHBAVTXDTXRITPMRNY6";
const headers = {
  "Authorization": `Bearer ${token}`
};


function generateCaption({ sleep, readiness, activity }) {
  const sleepScore = sleep?.score ?? 70;
  const readinessScore = readiness?.score ?? 75;
  const activityScore = activity?.score ?? 80;

  if (sleepScore > 85 && readinessScore > 80) {
    return "A night of deep renewal flows into today’s vision.";
  } else if (sleepScore > 70 && activityScore > 85) {
    return "The body moves, but the mind drifts between worlds.";
  } else if (sleepScore < 60) {
    return "A restless night leaves echoes in the dreamlight.";
  } else if (readinessScore < 65) {
    return "Beneath the glow, tension weaves through sleep’s surface.";
  } else {
    return "A quiet pulse of clarity hums beneath the haze.";
  }
}

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
    const response1 = await fetch("https://dreamviz-backend.onrender.com/oura-data");
    const ouraData = await response1.json();

    const sleep = ouraData.sleep?.data?.[0] ?? {};
    const readiness = ouraData.readiness?.data?.[0] ?? {};
    const activity = ouraData.activity?.data?.[0] ?? {};

    const sleepScore = sleep.score ?? 70;
    const readinessScore = readiness.score ?? 75;
    const tempDev = readiness.temperature_deviation ?? 0.0;
    const heartRate = readiness.contributors?.resting_heart_rate ?? 50;
    const activityScore = activity.score ?? 80;

    const url = `https://dreamviz-backend.onrender.com/generate-image?sleep=${sleepScore}&readiness=${readinessScore}&tempDev=${tempDev}&hr=${heartRate}&activity=${activityScore}`;
    const response2 = await fetch(url);
    const data = await response2.json();

    if (!data.base64) throw new Error("No image data returned");

    const caption = generateCaption({ sleep, readiness, activity });
    const timestamp = data.timestamp ?? new Date().toISOString();
    captionEl.textContent = `${caption} (${new Date(timestamp).toLocaleString()})`;

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
  const date = dateOverride ?? new Date().toISOString().split("T")[0];

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
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("date-picker").value = today;
  loadDreamByDate();
});


// Load gallery on page load
renderDreamGallery();