#!/usr/bin/env python3
"""
JARVIS Wake Word Engine — powered by OpenWakeWord.
Prints "WAKE_WORD_DETECTED" to stdout when "Hey JARVIS" is heard.
Designed to run as a standalone subprocess from Electron.
"""

import sys
import os
import signal
import numpy as np

# Suppress all TF / ONNX / OWW startup noise — only structured output goes to stdout
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["ORT_LOGGING_LEVEL"] = "3"

import warnings
warnings.filterwarnings("ignore")

try:
    import pyaudio
    from openwakeword.model import Model
except ImportError as e:
    print(f"ERROR:{e}", flush=True)
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────
RATE            = 16000
CHUNK           = 1280          # ~80ms frames (OWW default)
THRESHOLD       = 0.5           # confidence threshold
COOLDOWN_FRAMES = 30            # ~2.4s cooldown after detection

# ── Model ─────────────────────────────────────────────────────────────────────
# Priority order:
#   1. Any custom .onnx in services/oww-custom-models/ — trained externally,
#      e.g. via the OWW Colab notebook
#   2. The built-in "hey_jarvis" model that ships with openwakeword
#   3. Other built-ins as last resort
PREFERRED_MODELS = ["hey_jarvis", "hey_mycroft", "alexa"]

def _custom_models_dir():
    # Production (PyInstaller --onedir): bundled at <bundle>/oww-custom-models/
    here   = os.path.dirname(os.path.abspath(sys.executable))
    bundle = os.path.join(here, "oww-custom-models")
    if os.path.isdir(bundle):
        return bundle
    # Dev: source directory
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "oww-custom-models")

def _find_custom_onnx():
    d = _custom_models_dir()
    if not os.path.isdir(d):
        return None
    for f in sorted(os.listdir(d)):
        if f.endswith(".onnx"):
            return os.path.join(d, f)
    return None

def load_model():
    # 1. Custom user-trained model takes precedence
    custom = _find_custom_onnx()
    if custom:
        try:
            m = Model(wakeword_models=[custom], inference_framework="onnx")
            name = os.path.splitext(os.path.basename(custom))[0]
            print(f"READY:{name}", flush=True)
            return m, name
        except Exception as e:
            print(f"ERROR:custom_model_load_failed:{e}", flush=True)
            # fall through to built-ins

    # 2 + 3. Built-ins
    for name in PREFERRED_MODELS:
        try:
            m = Model(wakeword_models=[name], inference_framework="onnx")
            print(f"READY:{name}", flush=True)
            return m, name
        except Exception:
            continue
    try:
        m = Model(inference_framework="onnx")
        name = list(m.models.keys())[0]
        print(f"READY:{name}", flush=True)
        return m, name
    except Exception as e:
        print(f"ERROR:no_model:{e}", flush=True)
        sys.exit(1)

# ── Audio ─────────────────────────────────────────────────────────────────────
def open_stream(pa):
    try:
        return pa.open(
            rate=RATE, channels=1,
            format=pyaudio.paInt16,
            input=True,
            frames_per_buffer=CHUNK,
        )
    except Exception as e:
        print(f"ERROR:audio:{e}", flush=True)
        sys.exit(1)

# ── Main loop ─────────────────────────────────────────────────────────────────
def main():
    model, model_name = load_model()

    pa     = pyaudio.PyAudio()
    stream = open_stream(pa)

    cooldown = 0

    def shutdown(_sig, _frame):
        stream.stop_stream()
        stream.close()
        pa.terminate()
        sys.exit(0)

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT,  shutdown)

    while True:
        try:
            raw  = stream.read(CHUNK, exception_on_overflow=False)
            data = np.frombuffer(raw, dtype=np.int16)
        except Exception:
            continue

        if cooldown > 0:
            cooldown -= 1
            continue

        preds = model.predict(data)
        score = preds.get(model_name, 0.0)

        if score >= THRESHOLD:
            print("WAKE_WORD_DETECTED", flush=True)
            cooldown = COOLDOWN_FRAMES

if __name__ == "__main__":
    main()
