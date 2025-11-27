function loadFavorites() {
  const list = JSON.parse(localStorage.getItem("favorites") || "[]");
  const ul = document.getElementById("favorites-list");
  ul.innerHTML = "";

  list.forEach(url => {
    const li = document.createElement("li");
    li.className = "p-2 bg-zinc-700 rounded-lg cursor-pointer hover:bg-zinc-600";
    li.textContent = url;
    li.onclick = () => {
      document.getElementById("streamUrl").value = url;
      loadStream();
    };
    ul.appendChild(li);
  });
}

function addToFavorites() {
  const list = JSON.parse(localStorage.getItem("favorites") || "[]");
  if (window.currentUrl && !list.includes(window.currentUrl)) {
    list.push(window.currentUrl);
    localStorage.setItem("favorites", JSON.stringify(list));
    loadFavorites();
  }
}

loadFavorites();

