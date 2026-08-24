import { ensureFreshToken } from '@/lib/auth-api';
import { useAuthStore } from '@/stores/auth.store';
import { useCallback, useEffect, useRef, useState } from 'react';

export type LangueTranscription = 'fr' | 'en';

export type SegmentTranscriptionLive = {
  id: string;
  text: string;
  isFinal: boolean;
};

type ServerMessage =
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
  const langueRef = useRef<LangueTranscription>(langue);

  useEffect(() => {
    langueRef.current = langue;
  }, [langue]);

  const texteComplet = [...segments.map((s) => s.text), interim].filter(Boolean).join(' ').trim();

  const arreter = useCallback(() => {
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

      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          reject(new Error('Délai dépassé — backend WebSocket inaccessible'));
        }, 12000);

        ws.onmessage = (ev) => {
          if (typeof ev.data !== 'string') return;
          let msg: ServerMessage;
          try {
            msg = JSON.parse(ev.data) as ServerMessage;
          } catch {
            return;
          }

          if (msg.type === 'ready') {
            window.clearTimeout(timeout);
            resolve();
            return;
          }
          if (msg.type === 'error') {
            window.clearTimeout(timeout);
            reject(new Error(msg.message));
          }
        };

        ws.onerror = () => {
          window.clearTimeout(timeout);
          reject(new Error('Erreur WebSocket (vérifiez que le backend tourne)'));
        };
      });

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
        if (typeof ev.data !== 'string') return;
        let msg: ServerMessage;
        try {
          msg = JSON.parse(ev.data) as ServerMessage;
        } catch {
          return;
        }

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
        setActif(false);
        setConnecting(false);
      };

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
