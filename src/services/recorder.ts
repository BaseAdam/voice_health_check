import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';

// Protects the STT quota; check-in answers are short.
export const MAX_RECORDING_SECONDS = 30;

type Pending = {
  resolve: (uri: string | null) => void;
  reject: (error: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
};

/**
 * Push-to-talk recorder. `start()` resolves with the file URI once recording ends
 * (via `stop()` or the time limit), or null when the microphone permission is denied.
 */
export function useRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const pending = useRef<Pending | null>(null);

  async function stop() {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    clearTimeout(p.timer);
    try {
      await recorder.stop();
      p.resolve(recorder.uri);
    } catch (e) {
      p.reject(e);
    } finally {
      setIsRecording(false);
      // iOS: leave recording mode so later playback uses the loudspeaker.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    }
  }

  async function start(): Promise<string | null> {
    if (pending.current) return null;
    const { granted } = await requestRecordingPermissionsAsync();
    setPermissionDenied(!granted);
    if (!granted) return null;

    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setIsRecording(true);
    return new Promise((resolve, reject) => {
      pending.current = { resolve, reject, timer: setTimeout(stop, MAX_RECORDING_SECONDS * 1000) };
    });
  }

  // Unmount mid-recording: cancel the timer and settle the promise.
  useEffect(
    () => () => {
      if (pending.current) {
        clearTimeout(pending.current.timer);
        pending.current.resolve(null);
        pending.current = null;
      }
    },
    [],
  );

  return { start, stop, isRecording, permissionDenied };
}
