import os
import urllib.request
import ssl

# Ignore SSL errors
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

BASE_DIR = "js/libs/mediapipe"
CDN_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe"

FILES = [
    # Core Scripts
    ("camera_utils/camera_utils.js", f"{CDN_BASE}/camera_utils/camera_utils.js"),
    ("control_utils/control_utils.js", f"{CDN_BASE}/control_utils/control_utils.js"),
    ("drawing_utils/drawing_utils.js", f"{CDN_BASE}/drawing_utils/drawing_utils.js"),
    ("pose/pose.js", f"{CDN_BASE}/pose/pose.js"),
    ("pose/pose_web.binarypb", f"{CDN_BASE}/pose/pose_web.binarypb"),
    
    # Pose Assets (Required for offline use)
    ("pose/pose_solution_packed_assets_loader.js", f"{CDN_BASE}/pose/pose_solution_packed_assets_loader.js"),
    ("pose/pose_solution_packed_assets.data", f"{CDN_BASE}/pose/pose_solution_packed_assets.data"),
    ("pose/pose_solution_wasm_bin.js", f"{CDN_BASE}/pose/pose_solution_wasm_bin.js"),
    ("pose/pose_solution_wasm_bin.wasm", f"{CDN_BASE}/pose/pose_solution_wasm_bin.wasm"),
    ("pose/pose_solution_simd_wasm_bin.js", f"{CDN_BASE}/pose/pose_solution_simd_wasm_bin.js"),
    ("pose/pose_solution_simd_wasm_bin.wasm", f"{CDN_BASE}/pose/pose_solution_simd_wasm_bin.wasm"),
    ("pose/pose_landmark_full.tflite", f"{CDN_BASE}/pose/pose_landmark_full.tflite"),
]

def download_file(url, path):
    print(f"Downloading {url}...")
    try:
        # Create dir if not exists
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with urllib.request.urlopen(url, context=ctx) as response, open(path, 'wb') as out_file:
            data = response.read()
            out_file.write(data)
        print(f"Saved to {path}")
        return True
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return False

success_count = 0
for local_name, url in FILES:
    full_path = os.path.join(BASE_DIR, local_name)
    if download_file(url, full_path):
        success_count += 1

print(f"Download complete. {success_count}/{len(FILES)} files downloaded.")
if success_count == len(FILES):
    print("SUCCESS: All files ready.")
else:
    print("WARNING: Some files failed.")
