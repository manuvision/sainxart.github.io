const token = "23YGF6YEKBOFNFHBAVTXDTXRITPMRNY6";
const headers = {
  "Authorization": `Bearer ${token}`
};

async function fetchData() {
  try {
    const response = await fetch("https://dreamviz-backend.onrender.com/oura-data")
;
    const rawData = await response.json();

    const sleep = rawData.sleep.data?.[0] ?? {};
    const readiness = rawData.readiness.data?.[0] ?? {};
    const activity = rawData.activity.data?.[0] ?? {};

    document.getElementById("sleep-card").innerHTML = `
      <h2>Sleep Score: ${sleep.score ?? 'N/A'}</h2>
      <p><strong>Deep Sleep:</strong> ${sleep.contributors?.deep_sleep ?? 'N/A'}</p>
      <p><strong>REM Sleep:</strong> ${sleep.contributors?.rem_sleep ?? 'N/A'}</p>
      <p><strong>Efficiency:</strong> ${sleep.contributors?.efficiency ?? 'N/A'}</p>
    `;

    document.getElementById("readiness-card").innerHTML = `
      <h2>Readiness Score: ${readiness.score ?? 'N/A'}</h2>
      <p><strong>Recovery Index:</strong> ${readiness.contributors?.recovery_index ?? 'N/A'}</p>
      <p><strong>Resting HR:</strong> ${readiness.contributors?.resting_heart_rate ?? 'N/A'}</p>
      <p><strong>Body Temp:</strong> ${readiness.temperature_deviation ?? 'N/A'}</p>
    `;

    document.getElementById("activity-card").innerHTML = `
      <h2>Activity Score: ${activity.score ?? 'N/A'}</h2>
      <p><strong>Steps:</strong> ${activity.steps ?? 'N/A'}</p>
      <p><strong>Calories:</strong> ${activity.total_calories ?? 'N/A'}</p>
      <p><strong>Distance:</strong> ${activity.equivalent_walking_distance ?? 'N/A'} m</p>
    `;
  } catch (error) {
    console.error(error);
  }
}

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

    const caption = generateCaption({ sleep, readiness, activity });
document.getElementById("dream-caption").textContent = caption;


    const url = `https://dreamviz-backend.onrender.com/generate-image?sleep=${sleepScore}&readiness=${readinessScore}&tempDev=${tempDev}&hr=${heartRate}&activity=${activityScore}`;
    const response2 = await fetch(url);
    const data = await response2.json();

    if (!data.url) throw new Error("No image URL returned");
img.src = data.url;
img.alt = "Your dream image";

const date = new Date().toISOString().split("T")[0];
const savedDreams = JSON.parse(localStorage.getItem("dreamGallery") || "[]");

savedDreams.unshift({ date, src: data.url, caption });


    localStorage.setItem("dreamGallery", JSON.stringify(savedDreams.slice(0, 12)));

    renderDreamGallery();

  } catch (err) {
    console.error(err);
    img.alt = "Failed to load image.";
  } finally {
    loader.style.display = "none";
    button.disabled = false;
    button.textContent = "Generate Dream Image";
  }
}

function renderDreamGallery() {
  const container = document.getElementById("gallery");
  const dreams = JSON.parse(localStorage.getItem("dreamGallery") || "[]");

  container.innerHTML = "";

  dreams.forEach(dream => {
    const thumb = document.createElement("img");
    thumb.src = dream.src;
    thumb.alt = dream.date;
    thumb.title = dream.date;
    thumb.onclick = () => {
  const img = document.getElementById("dream-image");
  const captionEl = document.getElementById("dream-caption");
  img.src = dream.src;
  img.alt = "Your dream image from " + dream.date;
  captionEl.textContent = dream.caption || "";
};

    container.appendChild(thumb);
  });
}

// Load gallery on page load
renderDreamGallery();





