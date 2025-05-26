async function generateDreamImage() {
  const img = document.getElementById("dream-image");
  const loader = document.getElementById("loader");
  const button = document.querySelector("button[onclick='generateDreamImage()']");
  const captionEl = document.getElementById("dream-caption");
  const dreamText = document.getElementById("dream-input").value.trim();

  img.src = "";
  img.alt = "";
  loader.style.display = "block";
  button.disabled = true;
  button.textContent = "Generating...";

  try {
    // Fetch latest biometrics
    const biometricsRes = await fetch("https://dreamviz-backend.onrender.com/oura-data");
    const biometrics = await biometricsRes.json();

    const sleepScore = biometrics.sleep_score || 70;
    const readiness = biometrics.readiness_score || 75;
    const activity = biometrics.activity_score || 80;
    const tempDev = biometrics.temp_deviation || 0;

    // Prompt formula
    const colors = sleepScore > 69
      ? ['lavender', 'midnight blue', 'bioluminescent teal']
      : ['smoky orange', 'ashen red', 'dull yellow'];

    const mood = readiness > 75
      ? 'balanced, grounded, and fluid'
      : 'fragmented, unstable, and unpredictable';

    const texture = tempDev > 0
      ? 'flickering heat-like distortion with raw organic edges'
      : 'cool flowing surfaces with subtle translucency';

    const dreamPrompt = dreamText
      ? `Dream fragment: "${dreamText}". Visualize it as a surreal landscape shaped by inner emotion and sleep state.`
      : `No specific memory recalled. Render a symbolic dreamscape based purely on sleep biometrics.`;

    const prompt = `
${dreamPrompt}
An abstract digital landscape composed of ${mood} energy. Textures appear ${texture}, and color gradients include ${colors.join(', ')}.
There are no human figures, only shifting forms inspired by dream logic, memory fog, and emotional resonance.
`;

    // Send prompt to backend
    const response = await fetch("https://dreamviz-backend.onrender.com/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        sleep: sleepScore,
        readiness,
        activity,
        tempDev,
        dreamText
      })
    });

    const data = await response.json();
    if (!data.base64) throw new Error("No image data returned");

    const timestamp = data.timestamp ?? new Date().toISOString();
    captionEl.textContent = `${data.caption || 'Generated from dream'} (${new Date(timestamp).toLocaleString()})`;

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
