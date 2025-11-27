let resolvedStreams = {};
let currentQuality = "best";
let currentUrl = "";

function loadStream() {
  const input = document.getElementById("streamUrl").value;
  currentUrl = input;
  window.currentUrl = input;


  fetch("/api/resolve?url=" + encodeURIComponent(input))
    .then(r => r.json())
    .then(data => {
      if (data.error) {
        document.getElementById("stream-title").innerText = data.error;
        return;
      }

      document.getElementById("stream-title").innerText = data.title || "Stream";

      resolvedStreams = data.streams || {};
      currentQuality = data.default_quality || (resolvedStreams.best ? "best" : Object.keys(resolvedStreams)[0]);

      const qs = document.getElementById("qualitySelector");
      qs.innerHTML = "";

      Object.keys(resolvedStreams).forEach(q => {
        const opt = document.createElement("option");
        opt.value = q;
        opt.text = q;
        if (q === currentQuality) opt.selected = true;
        qs.appendChild(opt);
      });

      playStream(resolvedStreams[currentQuality]);
    })
    .catch(err => {
      document.getElementById("stream-title").innerText = "Failed to load stream";
      console.error(err);
    });
}

function switchQuality() {
  const qs = document.getElementById("qualitySelector");
  currentQuality = qs.value;
  if (resolvedStreams[currentQuality]) {
    playStream(resolvedStreams[currentQuality]);
  }
}

