import { ensureFreshToken } from '@/lib/auth-api';
import { obtenirStatutStt } from '@/lib/transcriptions-api';
import { useAuthStore } from '@/stores/auth.store';
import { useCallback, useEffect, useRef, useState } from 'react';

export type LangueTranscription = 'fr' | 'en';

export type SegmentTranscriptionLive = {
  id: string;
  text: string;
  isFinal: boolean;
};

type ServerMessage =
  | { type: 'connecting'; reunionId: string }
  | { type: 'ready'; reunionId: string; language: string; model: string }
  | { type: 'transcript'; text: string; is_final: boolean }
  | { type: 'error'; message: string }
  | { type: 'closed' }
  | { type: 'pong' };

function buildWsUrl(
  reunionId: string,
  token: string | null,
  language: LangueTranscription,
): string {
  const httpBase = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:4000';
  const wsBase = httpBase.replace(/^http/i, 'ws').replace(/\/$/, '');
  const params = new URLSearchParams({ reunionId, language });
  if (token) params.set('token', token);
  return `${wsBase}/ws/transcription?${params.toString()}`;
}

function downsampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === 16000) return input;
  const ratio = inputSampleRate / 16000;
  const newLen = Math.max(1, Math.round(input.length / ratio));
  const result = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const idx = Math.min(input.length - 1, Math.floor(i * ratio));
    result[i] = input[idx]!;
  }
  return result;
}

function floatTo16BitPCM(float32: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]!));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

let segmentSeq = 0;

function parseServerMessage(raw: unknown): ServerMessage | null {
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as ServerMessage;
  } catch {
    return null;
  }
}

/** Attend le message `ready` ou une erreur explicite du proxy backend. */
function attendrePret(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof window.setTimeout> | undefined;
    let backendVu = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (timeout) window.clearTimeout(timeout);
      fn();
    };

    const planifierTimeout = (delaiMs: number, message: string) => {
      if (timeout) window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        finish(() => reject(new Error(message)));
      }, delaiMs);
    };

    planifierTimeout(
      12_000,
      'Délai dépassé — backend WebSocket inaccessible. Vérifiez que le serveur Node tourne (port 4000) et VITE_API_URL.',
    );

    ws.onmessage = (ev) => {
      const msg = parseServerMessage(ev.data);
      if (!msg) return;

      if (msg.type === 'connecting') {
        backendVu = true;
        planifierTimeout(
          18_000,
          'Le backend répond mais Deepgram ne répond pas. Vérifiez DEEPGRAM_API_KEY (clé, quota ou réseau).',
        );
        return;
      }

      if (msg.type === 'ready') {
        finish(resolve);
        return;
      }

      if (msg.type === 'error') {
        finish(() => reject(new Error(msg.message)));
      }
    };

    ws.onerror = () => {
      finish(() =>
        reject(
          new Error(
            'Connexion WebSocket impossible. Vérifiez VITE_API_URL et que le backend est démarré.',
          ),
        ),
      );
    };

    ws.onclose = () => {
      if (backendVu) {
        finish(() =>
          reject(
            new Error(
              'Connexion transcription fermée avant initialisation (Deepgram ou réseau).',
            ),
          ),
        );
        return;
      }
      finish(() =>
        reject(
          new Error(
            'Connexion WebSocket fermée — backend inaccessible. Démarrez le serveur backend.',
          ),
        ),
      );
    };
  });
}

export function useTranscriptionLive(reunionId: string) {
  const [actif, setActif] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [interim, setInterim] = useState('');
  const [segments, setSegments] = useState<SegmentTranscriptionLive[]>([]);
  const [langue, setLangue] = useState<LangueTranscription>('fr');
  const [sauvegardeOk, setSauvegardeOk] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const pingRef = useRef<number | null>(null);
  const langueRef = useRef<LangueTranscription>(langue);

  useEffect(() => {
    langueRef.current = langue;
  }, [langue]);

  const texteComplet = [...segments.map((s) => s.text), interim].filter(Boolean).join(' ').trim();

  const arreter = useCallback(() => {
    if (pingRef.current != null) {
      window.clearInterval(pingRef.current);
      pingRef.current = null;
    }

    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'close' }));
        wsRef.current.close();
      }
    } catch {
      /* ignore */
    }
    wsRef.current = null;

    try {
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    processorRef.current = null;
    sourceRef.current = null;

    try {
      void ctxRef.current?.close();
    } catch {
      /* ignore */
    }
    ctxRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    setActif(false);
    setConnecting(false);
    setInterim('');
  }, []);

  const demarrer = useCallback(async () => {
    setErreur(null);
    setSauvegardeOk(false);
    setConnecting(true);
    arreter();

    try {
      const stt = await obtenirStatutStt();
      if (!stt.disponible) {
        throw new Error(
          stt.message ??
            'Transcription live indisponible (Deepgram non configuré côté backend).',
        );
      }

      const token =
        (await ensureFreshToken()) ?? useAuthStore.getState().accessToken ?? null;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
        video: false,
      });
      streamRef.current = stream;

      const ws = new WebSocket(buildWsUrl(reunionId, token, langueRef.current));
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      await attendrePret(ws);

      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      await ctx.resume();
      ctxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const socket = wsRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        const down = downsampleTo16k(input, ctx.sampleRate);
        socket.send(floatTo16BitPCM(down));
      };

      source.connect(processor);
      const mute = ctx.createGain();
      mute.gain.value = 0;
      processor.connect(mute);
      mute.connect(ctx.destination);

      ws.onmessage = (ev) => {
        const msg = parseServerMessage(ev.data);
        if (!msg) return;

        if (msg.type === 'transcript') {
          if (msg.is_final) {
            setSegments((prev) => [
              ...prev,
              { id: `seg-${++segmentSeq}`, text: msg.text, isFinal: true },
            ]);
            setInterim('');
          } else {
            setInterim(msg.text);
          }
          return;
        }

        if (msg.type === 'error') {
          setErreur(msg.message);
          arreter();
          return;
        }

        if (msg.type === 'closed') {
          setActif(false);
          setConnecting(false);
        }
      };

      ws.onclose = () => {
        if (pingRef.current != null) {
          window.clearInterval(pingRef.current);
          pingRef.current = null;
        }
        setActif(false);
        setConnecting(false);
        setErreur((prev) => prev ?? 'Connexion transcription interrompue.');
      };

      pingRef.current = window.setInterval(() => {
        const socket = wsRef.current;
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25_000);

      setActif(true);
      setConnecting(false);
    } catch (e) {
      arreter();
      const message =
        e instanceof DOMException &&
        (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')
          ? 'Micro refusé. Autorisez le micro dans le navigateur.'
          : e instanceof Error
            ? e.message
            : 'Impossible de démarrer la transcription.';
      setErreur(message);
      setConnecting(false);
    }
  }, [arreter, reunionId]);

  const effacer = useCallback(() => {
    setSegments([]);
    setInterim('');
    setSauvegardeOk(false);
  }, []);

  useEffect(() => () => arreter(), [arreter]);

  return {
    actif,
    connecting,
    erreur,
    interim,
    segments,
    langue,
    setLangue,
    texteComplet,
    sauvegardeOk,
    setSauvegardeOk,
    demarrer,
    arreter,
    effacer,
  };
}
