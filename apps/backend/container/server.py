"""
PDF Processing Container Server
Flask server providing PDF processing endpoints for VIPS, OpenCV, and OCR operations.
"""
import io
import json
import traceback
from flask import Flask, request, jsonify
import pyvips
import cv2
import numpy as np
import pytesseract
from PIL import Image

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy"})

@app.route('/generate-images', methods=['POST'])
def generate_images():
    """
    Convert PDF to 300 DPI PNG images using pyvips
    Headers: X-Sheet-Id, X-Plan-Id
    Body: PDF binary data
    Returns: {"images": [{"sheetId": "...", "imageUrl": "..."}]}
    """
    try:
        sheet_id = request.headers.get('X-Sheet-Id')
        plan_id = request.headers.get('X-Plan-Id')

        if not sheet_id or not plan_id:
            return jsonify({"error": "Missing X-Sheet-Id or X-Plan-Id header"}), 400

        pdf_data = request.get_data()
        if not pdf_data:
            return jsonify({"error": "No PDF data provided"}), 400

        # Load PDF with pyvips
        image = pyvips.Image.new_from_buffer(pdf_data, '', dpi=300, access='sequential')

        # Convert to PNG
        png_data = image.write_to_buffer('.png')

        # In production, upload to R2 and return URL
        # For now, return success with metadata
        return jsonify({
            "images": [{
                "sheetId": sheet_id,
                "imageUrl": f"r2://plans/{plan_id}/sheets/{sheet_id}.png",
                "width": image.width,
                "height": image.height,
                "dpi": 300
            }]
        })

    except Exception as e:
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500

@app.route('/extract-metadata', methods=['POST'])
def extract_metadata():
    """
    Extract metadata from title block using OCR
    Headers: X-Sheet-Id
    Body: PNG binary data
    Returns: {"sheetNumber": "A-101", "sheetTitle": "FLOOR PLAN"}
    """
    try:
        sheet_id = request.headers.get('X-Sheet-Id')
        if not sheet_id:
            return jsonify({"error": "Missing X-Sheet-Id header"}), 400

        image_data = request.get_data()
        if not image_data:
            return jsonify({"error": "No image data provided"}), 400

        # Load image
        image = Image.open(io.BytesIO(image_data))
        width, height = image.size

        # Title blocks typically in bottom-right corner
        # Crop to bottom 15% and right 40% of image
        crop_height = int(height * 0.15)
        crop_width = int(width * 0.40)
        title_block = image.crop((width - crop_width, height - crop_height, width, height))

        # OCR the title block
        text = pytesseract.image_to_string(title_block, config='--psm 6')

        # Parse sheet number and title (simple heuristic)
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        sheet_number = None
        sheet_title = None

        # Look for patterns like "A-101", "S-2.1"
        for line in lines:
            if '-' in line and any(c.isdigit() for c in line):
                sheet_number = line
                break

        # Title is typically the longest line
        if lines:
            sheet_title = max(lines, key=len)

        return jsonify({
            "sheetNumber": sheet_number,
            "sheetTitle": sheet_title,
            "rawText": text
        })

    except Exception as e:
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500

@app.route('/detect-callouts', methods=['POST'])
def detect_callouts():
    """
    Detect callouts using OpenCV shape detection
    Headers: X-Sheet-Id, X-DPI (default: 300)
    Body: PNG binary data
    Returns: {"shapes": [{"type": "circle", "centerX": 100, "centerY": 200, "bbox": {...}}]}
    """
    try:
        sheet_id = request.headers.get('X-Sheet-Id')
        dpi = int(request.headers.get('X-DPI', '300'))

        if not sheet_id:
            return jsonify({"error": "Missing X-Sheet-Id header"}), 400

        image_data = request.get_data()
        if not image_data:
            return jsonify({"error": "No image data provided"}), 400

        # Load image with OpenCV
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        shapes = []

        # Detect circles using Hough transform
        circles = cv2.HoughCircles(
            gray,
            cv2.HOUGH_GRADIENT,
            dp=1,
            minDist=50,
            param1=50,
            param2=30,
            minRadius=10,
            maxRadius=50
        )

        if circles is not None:
            circles = np.round(circles[0, :]).astype("int")
            for (x, y, r) in circles:
                shapes.append({
                    "type": "circle",
                    "method": "hough",
                    "centerX": int(x),
                    "centerY": int(y),
                    "radius": int(r),
                    "bbox": {
                        "x1": int(x - r),
                        "y1": int(y - r),
                        "x2": int(x + r),
                        "y2": int(y + r)
                    },
                    "confidence": 0.8
                })

        # Detect contours for other shapes
        edges = cv2.Canny(gray, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for contour in contours:
            area = cv2.contourArea(contour)
            if area < 100 or area > 10000:
                continue

            # Approximate contour to polygon
            epsilon = 0.04 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)

            x, y, w, h = cv2.boundingRect(contour)
            centerX = x + w // 2
            centerY = y + h // 2

            shape_type = "unknown"
            if len(approx) == 3:
                shape_type = "triangle"
            elif len(approx) == 4:
                aspect_ratio = float(w) / h
                if 0.9 <= aspect_ratio <= 1.1:
                    shape_type = "section_flag"

            if shape_type != "unknown":
                shapes.append({
                    "type": shape_type,
                    "method": "contour",
                    "centerX": int(centerX),
                    "centerY": int(centerY),
                    "bbox": {
                        "x1": int(x),
                        "y1": int(y),
                        "x2": int(x + w),
                        "y2": int(y + h)
                    },
                    "confidence": 0.7
                })

        return jsonify({
            "shapes": shapes,
            "imageWidth": img.shape[1],
            "imageHeight": img.shape[0],
            "totalDetections": len(shapes),
            "byMethod": {
                "hough": len([s for s in shapes if s["method"] == "hough"]),
                "contour": len([s for s in shapes if s["method"] == "contour"])
            }
        })

    except Exception as e:
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500

@app.route('/generate-tiles', methods=['POST'])
def generate_tiles():
    """
    Generate PMTiles from PNG using pyvips dzsave
    Headers: X-Sheet-Id, X-Plan-Id
    Body: PNG binary data
    Returns: {"tilesUrl": "r2://..."}
    """
    try:
        sheet_id = request.headers.get('X-Sheet-Id')
        plan_id = request.headers.get('X-Plan-Id')

        if not sheet_id or not plan_id:
            return jsonify({"error": "Missing X-Sheet-Id or X-Plan-Id header"}), 400

        image_data = request.get_data()
        if not image_data:
            return jsonify({"error": "No image data provided"}), 400

        # Load image with pyvips
        image = pyvips.Image.new_from_buffer(image_data, '')

        # Generate deep zoom tiles
        # In production, write to temp dir, package as PMTiles, upload to R2
        # For now, return success
        return jsonify({
            "tilesUrl": f"r2://plans/{plan_id}/sheets/{sheet_id}.pmtiles",
            "minZoom": 0,
            "maxZoom": 5,
            "bounds": [0, 0, image.width, image.height]
        })

    except Exception as e:
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3001, debug=False)
