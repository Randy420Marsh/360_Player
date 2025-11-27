function loadFavorites() {
  const list = JSON.parse(localStorage.getItem("favorites") || "[]");
  const ul = document.getElementById("favorites-list");
  ul.innerHTML = "";

  if (list.length === 0) {
    const li = document.createElement("li");
    li.className = "p-2 text-zinc-500 text-sm italic";
    li.textContent = "No favorites yet. Add streams using the 'Add to Favorites' button.";
    ul.appendChild(li);
    return;
  }

  list.forEach((url, index) => {
    const li = document.createElement("li");
    li.className = "flex items-center gap-2 p-2 bg-zinc-700 rounded-lg hover:bg-zinc-600";
    
    // Stream URL (clickable)
    const urlSpan = document.createElement("span");
    urlSpan.className = "flex-1 cursor-pointer truncate";
    urlSpan.textContent = url;
    urlSpan.onclick = () => {
      document.getElementById("streamUrl").value = url;
      loadStream();
    };
    
    // Remove button
    const removeBtn = document.createElement("button");
    removeBtn.className = "px-3 py-1 text-xs bg-red-600 hover:bg-red-700 rounded text-white";
    removeBtn.textContent = "Remove";
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      removeFavorite(index);
    };
    
    li.appendChild(urlSpan);
    li.appendChild(removeBtn);
    ul.appendChild(li);
  });
}

function addToFavorites() {
  const list = JSON.parse(localStorage.getItem("favorites") || "[]");
  if (window.currentUrl && !list.includes(window.currentUrl)) {
    list.push(window.currentUrl);
    localStorage.setItem("favorites", JSON.stringify(list));
    loadFavorites();
    showNotification("Added to favorites!");
  } else if (list.includes(window.currentUrl)) {
    showNotification("Already in favorites!");
  } else {
    showNotification("No stream loaded!");
  }
}

function removeFavorite(index) {
  const list = JSON.parse(localStorage.getItem("favorites") || "[]");
  const removed = list.splice(index, 1);
  localStorage.setItem("favorites", JSON.stringify(list));
  loadFavorites();
  showNotification("Removed from favorites!");
}

function clearAllFavorites() {
  if (confirm("Are you sure you want to clear all favorites?")) {
    localStorage.setItem("favorites", JSON.stringify([]));
    loadFavorites();
    showNotification("All favorites cleared!");
  }
}

function showNotification(message) {
  // Create notification element
  const notification = document.createElement("div");
  notification.className = "fixed top-4 right-4 bg-zinc-800 text-zinc-200 px-4 py-3 rounded-lg shadow-lg border border-white/10 z-50 animate-fade-in";
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Remove after 2 seconds
  setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transition = "opacity 0.3s";
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

loadFavorites();
