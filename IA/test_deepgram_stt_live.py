"""
Test Deepgram STT live depuis le terminal (sans Jupyter).
Usage (dans IA avec venv activé) :
  python test_deepgram_stt_live.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

import sounddevice as sd
from deepgram import DeepgramClient, LiveOptions, LiveTranscriptionEvents

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "").strip()
DEEPGRAM_LANGUAGE = os.getenv("DEEPGRAM_LANGUAGE", "fr").strip() or "fr"
DEEPGRAM_MODEL = os.getenv("DEEPGRAM_MODEL", "nova-3").strip() or "nova-3"
SAMPLE_RATE = 16000

if not DEEPGRAM_API_KEY:
    sys.exit("DEEPGRAM_API_KEY manquant dans .env")

segments_finaux: list[str] = []


def on_open(self, open=None, **kwargs):
    print("Connecte a Deepgram")


def on_message(self, result=None, **kwargs):
    if result is None:
        return
    try:
        transcript = result.channel.alternatives[0].transcript
    except Exception:
        return
    if not transcript or not str(transcript).strip():
        return
    texte = str(transcript).strip()
    is_final = bool(getattr(result, "is_final", False))
    print(f"{'[FINAL]' if is_final else '[Interim]'} {texte}")
    if is_final:
        segments_finaux.append(texte)


def on_error(self, error=None, **kwargs):
    print("Erreur:", error)


def on_close(self, close=None, **kwargs):
    print("Connexion fermee")


def main() -> None:
    client = DeepgramClient(DEEPGRAM_API_KEY)
    dg = client.listen.live.v("1")
    dg.on(LiveTranscriptionEvents.Open, on_open)
    dg.on(LiveTranscriptionEvents.Transcript, on_message)
    dg.on(LiveTranscriptionEvents.Error, on_error)
    dg.on(LiveTranscriptionEvents.Close, on_close)

    options = LiveOptions(
        model=DEEPGRAM_MODEL,
        language=DEEPGRAM_LANGUAGE,
        encoding="linear16",
        channels=1,
        sample_rate=SAMPLE_RATE,
        interim_results=True,
        punctuate=True,
        smart_format=True,
        endpointing=300,
    )

    print("Entree pour DEMARRER…")
    input()
    if dg.start(options) is False:
        sys.exit("Echec demarrage Deepgram")

    def audio_callback(indata, frames, time_info, status):
        if status:
            print("Audio status:", status)
        dg.send(bytes(indata))

    print("REC — parle en francais. Entree pour ARRETER.")
    try:
        with sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=1,
            dtype="int16",
            blocksize=4096,
            callback=audio_callback,
        ):
            input()
    finally:
        dg.finish()

    print("\n=== TEXTE FINAL ===\n")
    print(" ".join(segments_finaux) or "(vide)")


if __name__ == "__main__":
    main()
