from flask import Flask, request, jsonify, render_template
from streamlink import Streamlink
import requests
import re
from urllib.parse import urlparse

app = Flask(__name__)  # MISSING: Flask app initialization

VIDEO_EXTS = (".mp4", ".webm", ".ogv", ".mov", ".m4v")

def is_direct_media(url: str) -> bool:
    lower = url.lower()
    if ".m3u8" in lower:
        return True
    return any(re.search(re.escape(ext) + r"($|[?#])", lower) for ext in VIDEO_EXTS)

def title_from_url(url: str) -> str:
    try:
        p = urlparse(url)
        name = (p.path or "").rstrip("/").split("/")[-1]
        return name or p.netloc or "Stream"
    except:
        return "Stream"

def extract_streams(input_url):
    session = Streamlink()
    streams = session.streams(input_url)
    output = {}
    for quality, stream in streams.items():
        try:
            output[quality] = stream.to_url()
        except:
            pass
    return output

def fetch_title(url):
    try:
        r = requests.get(url, timeout=5, headers={"User-Agent": "Mozilla/5.0"})
        if "<title>" in r.text:
            return r.text.split("<title>")[1].split("</title>")[0]
    except:
        pass
    return "Unknown Stream Title"

@app.route("/")
def index():
    return render_template("player.html")

@app.route("/api/resolve")
def resolve():
    source = request.args.get("url", "")
    if not source:
        return jsonify({"error": "Missing 'url' parameter"}), 400

    # Direct HLS / direct video: bypass Streamlink
    # FIXED: Indentation error on line 47
    if is_direct_media(source):
        return jsonify({
            "input": source,
            "title": title_from_url(source),
            "default_quality": "best",
            "streams": {"best": source}
        })

    try:
        streams = extract_streams(source)
        if not streams:
            return jsonify({"error": "No playable streams found"}), 404

        title = fetch_title(source)

        return jsonify({
            "input": source,
            "title": title,
            "default_quality": "best" if "best" in streams else list(streams.keys())[0],
            "streams": streams
        })

    except Exception as e:
        # Still JSON, but clearer for debugging
        return jsonify({"error": f"Streamlink failed: {str(e)}"}), 422

if __name__ == "__main__":
    app.run(host="localhost", port=8081, debug=True)
