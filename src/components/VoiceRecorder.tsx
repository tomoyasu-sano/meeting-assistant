"use client";

import { useState, useRef, useEffect } from "react";

type VoiceRecorderProps = {
  participantId: string;
  participantName: string;
  onUploadSuccess?: () => void;
};

type RecordingState = "idle" | "recording" | "recorded";

export function VoiceRecorder({
  participantId,
  participantName,
  onUploadSuccess,
}: VoiceRecorderProps) {
  const [recordingState, setRecordingState] =
    useState<RecordingState>("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 録音時間のカウント
  useEffect(() => {
    if (recordingState === "recording") {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [recordingState]);

  // 録音開始
  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);

        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // ストリームを停止
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setRecordingState("recording");
      setRecordingTime(0);
    } catch (err) {
      console.error("録音開始エラー:", err);
      setError(
        "マイクへのアクセスが許可されていません。ブラウザの設定を確認してください。"
      );
    }
  };

  // 録音停止
  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === "recording") {
      mediaRecorderRef.current.stop();
      setRecordingState("recorded");
    }
  };

  // やり直し
  const resetRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingState("idle");
    setRecordingTime(0);
    setError(null);
  };

  // アップロード
  const uploadVoice = async () => {
    if (!audioBlob) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      const timestamp = Date.now();
      const filename = `${participantId}_${timestamp}.webm`;
      formData.append("file", audioBlob, filename);
      formData.append("participantId", participantId);
      formData.append("durationSeconds", String(recordingTime));

      const response = await fetch("/api/voice-upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "アップロードに失敗しました");
      }

      // 成功したらリセット
      resetRecording();
      onUploadSuccess?.();
    } catch (err) {
      console.error("アップロードエラー:", err);
      setError(
        err instanceof Error ? err.message : "アップロードに失敗しました"
      );
    } finally {
      setIsUploading(false);
    }
  };

  // 録音時間を MM:SS 形式で表示
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-zinc-900">
          {participantName}の音声を登録
        </h3>
        <p className="mt-1 text-sm text-zinc-600">
          5〜10秒程度の音声サンプルを録音してください
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* 録音前 */}
        {recordingState === "idle" && (
          <div className="mt-6 text-center">
            <button
              onClick={startRecording}
              className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              録音開始
            </button>
          </div>
        )}

        {/* 録音中 */}
        {recordingState === "recording" && (
          <div className="mt-6 space-y-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
              <span className="text-2xl font-mono font-semibold text-zinc-900">
                {formatTime(recordingTime)}
              </span>
            </div>
            <button
              onClick={stopRecording}
              className="rounded-lg bg-red-600 px-6 py-3 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              録音停止
            </button>
          </div>
        )}

        {/* 録音完了 */}
        {recordingState === "recorded" && audioUrl && (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg bg-zinc-50 p-4">
              <p className="text-sm font-medium text-zinc-700">
                録音時間: {formatTime(recordingTime)}
              </p>
              <audio
                src={audioUrl}
                controls
                className="mt-3 w-full"
                controlsList="nodownload"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={uploadVoice}
                disabled={isUploading}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUploading ? "アップロード中..." : "この音声で登録"}
              </button>
              <button
                onClick={resetRecording}
                disabled={isUploading}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                やり直し
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
