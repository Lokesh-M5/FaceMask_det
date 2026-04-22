import os, io, base64, json
import numpy as np
from flask import Flask, render_template, request, jsonify, redirect, url_for
from PIL import Image
import tensorflow as tf

app = Flask(__name__)
app.config['SECRET_KEY'] = 'change-this-in-production'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB max upload

# ── Config ───────────────────────────────────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'ml_model', 'Mask_detection_model.h5')
IMG_SIZE   = 128

# ── Load model once at startup ───────────────────────────────────────────────
_model = None

def get_model():
    global _model
    if _model is None:
        _model = tf.keras.models.load_model(MODEL_PATH)
    return _model


def preprocess_image(img: Image.Image):
    """Resize, normalise and expand dims for model input."""
    img = img.convert('RGB').resize((IMG_SIZE, IMG_SIZE))
    arr = np.array(img) / 255.0
    return np.expand_dims(arr, axis=0)


def make_prediction(img: Image.Image):
    """Return label, confidence, and CSS class."""
    model = get_model()
    inp   = preprocess_image(img)
    prob  = float(model.predict(inp, verbose=0)[0][0])

    # sigmoid output → 0 = with_mask, 1 = without_mask
    if prob < 0.5:
        label      = 'With Mask'
        confidence = (1 - prob) * 100
        css_class  = 'result-safe'
        icon       = '✅'
    else:
        label      = 'No Mask'
        confidence = prob * 100
        css_class  = 'result-danger'
        icon       = '⚠️'

    return {
        'label':      label,
        'confidence': round(confidence, 2),
        'css_class':  css_class,
        'icon':       icon,
    }


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/predict', methods=['POST'])
def predict():
    """Handle uploaded image file."""
    uploaded = request.files.get('image')
    if not uploaded:
        return render_template('index.html', error='No image uploaded.')

    try:
        img    = Image.open(uploaded.stream)
        result = make_prediction(img)

        # Convert image to base64 for display
        buf = io.BytesIO()
        img.convert('RGB').save(buf, format='JPEG')
        img_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')

        return render_template('result.html', result=result, img_b64=img_b64, source='upload')
    except Exception as e:
        return render_template('index.html', error=f'Error processing image: {e}')


@app.route('/webcam', methods=['POST'])
def webcam():
    """Handle base64 frame from webcam (AJAX POST)."""
    try:
        data      = request.get_json()
        img_data  = data['image'].split(',')[1]   # strip "data:image/jpeg;base64,"
        img_bytes = base64.b64decode(img_data)
        img       = Image.open(io.BytesIO(img_bytes))
        result    = make_prediction(img)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)
