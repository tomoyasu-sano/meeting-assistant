"use client";

import React, { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

export default function STTTestPage() {
  const [sessionId] = useState(() => uuidv4());
  const [isRecording, setIsRecording] = useState(false);
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ chunksUploaded: 0, bytesUploaded: 0 });

  const eventSourceRef = useRef<EventSource | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const uploadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pcmChunksRef = useRef<Int16Array[]>([]);
  const sequenceRef = useRef(0);

  // 録音開始
  const startRecording = async () => {
    try {
      setError(null);
      setTranscripts([]);
      setStats({ chunksUploaded: 0, bytesUploaded: 0 });

      console.log("[STT Test] 🎤 Starting...", { sessionId });

      // 1. SSE接続
      const eventSource = new EventSource(`/api/stt/test?sessionId=${sessionId}`);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener("ready", () => {
        console.log("[STT Test] ✅ SSE Ready");
      });

      eventSource.addEventListener("partial", (e) => {
        const data = JSON.parse(e.data);
        console.log("[STT Test] 📝 Partial:", data.text);
        setTranscripts((prev) => {
          const filtered = prev.filter((t) => t.isFinal);
          return [...filtered, { ...data, id: Date.now() }];
        });
      });

      eventSource.addEventListener("final", (e) => {
        const data = JSON.parse(e.data);
        console.log("[STT Test] ✅ Final:", data.text);
        setTranscripts((prev) => {
          const filtered = prev.filter((t) => t.isFinal);
          return [...filtered, { ...data, id: Date.now() }];
        });
      });

      eventSource.addEventListener("error", (e: any) => {
        console.error("[STT Test] ❌ SSE Error", e);
        setError("SSE connection error");
      });

      // 2. AudioWorklet setup
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      const AudioContextCtor = (window.AudioContext ||
        (window as any).webkitAudioContext) as typeof AudioContext;
      const audioContext = new AudioContextCtor({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      await audioContext.audioWorklet.addModule("/worklets/pcm16-processor.js");

      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, "pcm16-processor");
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = ({ data }) => {
        if (data instanceof Int16Array) {
          pcmChunksRef.current.push(data);
        } else if (data?.buffer) {
          pcmChunksRef.current.push(new Int16Array(data.buffer));
        }
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);

      console.log("[STT Test] 🎵 Audio pipeline ready");

      // 3. 500msごとにアップロード
      uploadIntervalRef.current = setInterval(async () => {
        if (pcmChunksRef.current.length === 0) return;

        const chunks = pcmChunksRef.current.splice(0);
        const totalSamples = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const combined = new Int16Array(totalSamples);

        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }

        const audioBlob = new Blob([combined.buffer], { type: "audio/pcm" });

        const formData = new FormData();
        formData.append("sessionId", sessionId);
        formData.append("audio", audioBlob);
        formData.append("sequence", sequenceRef.current.toString());

        try {
          const response = await fetch("/api/stt/test-upload", {
            method: "POST",
            body: formData,
          });

          if (response.ok) {
            setStats((prev) => ({
              chunksUploaded: prev.chunksUploaded + 1,
              bytesUploaded: prev.bytesUploaded + audioBlob.size,
            }));
            sequenceRef.current++;
          }
        } catch (uploadError) {
          console.error("[STT Test] Upload error", uploadError);
        }
      }, 500);

      setIsRecording(true);
    } catch (err) {
      console.error("[STT Test] Start error", err);
      setError(err instanceof Error ? err.message : "Failed to start");
    }
  };

  // 録音停止
  const stopRecording = () => {
    console.log("[STT Test] 🛑 Stopping...");

    if (uploadIntervalRef.current) {
      clearInterval(uploadIntervalRef.current);
      uploadIntervalRef.current = null;
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.port.onmessage = null;
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    pcmChunksRef.current = [];
    sequenceRef.current = 0;
    setIsRecording(false);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Speech-to-Text テスト
          </h1>
          <p className="mt-2 text-gray-600">
            Google Cloud Speech-to-Text APIでリアルタイム文字起こし
          </p>
        </div>

        {/* コントロール */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-6">
          <div className="flex items-center gap-4">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="rounded-lg bg-red-600 px-6 py-3 text-white font-medium hover:bg-red-700 transition-colors"
              >
                🎤 録音開始
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="rounded-lg bg-gray-600 px-6 py-3 text-white font-medium hover:bg-gray-700 transition-colors"
              >
                ⏹️ 録音停止
              </button>
            )}

            {isRecording && (
              <div className="flex items-center gap-2 text-red-600">
                <span className="inline-block w-3 h-3 bg-red-600 rounded-full animate-pulse"></span>
                <span className="font-medium">録音中...</span>
              </div>
            )}
          </div>

          {/* 統計情報 */}
          {isRecording && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">アップロードチャンク数：</span>
                  <span className="font-mono font-semibold ml-2">
                    {stats.chunksUploaded}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">送信データ量：</span>
                  <span className="font-mono font-semibold ml-2">
                    {(stats.bytesUploaded / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* エラー */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-6">
            <p className="text-red-800">❌ {error}</p>
          </div>
        )}

        {/* 文字起こし結果 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            文字起こし結果
          </h2>

          <div className="min-h-[300px] space-y-3">
            {transcripts.length === 0 ? (
              <p className="text-gray-500">録音を開始すると、ここに文字起こし結果が表示されます</p>
            ) : (
              transcripts.map((t) => (
                <div
                  key={t.id}
                  className={`p-3 rounded-lg ${
                    t.isFinal
                      ? "bg-blue-50 border border-blue-200"
                      : "bg-gray-50 border border-gray-200"
                  }`}
                >
                  <p className="text-gray-900">{t.text}</p>
                  {t.isFinal && t.confidence !== undefined && (
                    <p className="text-xs text-gray-600 mt-1">
                      信頼度: {(t.confidence * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 説明 */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 shadow-sm mt-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            このテストについて
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Google Cloud Speech-to-Text v1 API を使用</li>
            <li>• モデル: latest_long（高精度・長尺対応）</li>
            <li>• 音声フォーマット: LINEAR16, 16kHz, Mono</li>
            <li>• リアルタイムストリーミング認識（interim + final results）</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
