"use client";

import { useRef, useCallback, useState } from "react";

/**
 * リアルタイムAI統合フック（WebRTC版）
 * Stage 10.2: WebRTC + OpenAI Realtime API
 *
 * マイク音声を直接OpenAIに送信し、音声/テキスト応答を受け取る
 */

type Transcript = {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  isFinal: boolean;
};

type AIResponse = {
  audio?: ArrayBuffer;
  text: string;
  timestamp: string;
};

type OutputMode = "text" | "audio" | "text_audio";

export function useRealtimeAI(
  meetingId: string,
  onTranscript: (transcript: Transcript) => void,
  onAIResponse: (response: AIResponse) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // ゲーティング用の状態
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const lastAIResponseTimeRef = useRef<number>(0);
  const speakerStartTimeRef = useRef<Record<string, number>>({});
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 会話履歴の保持（最新10件）
  const conversationHistoryRef = useRef<Transcript[]>([]);

  // 使用量トラッキング
  const usageRef = useRef({
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalInputAudioTokens: 0,
    totalOutputAudioTokens: 0,
    totalCostUSD: 0,
    totalCostJPY: 0,
    responseCount: 0,
  });

  /**
   * 使用量から料金を計算（USD + JPY）
   */
  const calculateCost = useCallback(
    (
      inputTokens: number,
      outputTokens: number,
      inputAudioTokens: number,
      outputAudioTokens: number
    ) => {
      // OpenAI Realtime API 料金（最新: 2025年1月時点）
      // gpt-realtime (gpt-4o-realtime)
      const RATE_TEXT_INPUT = 4.0 / 1_000_000; // $4.00 per 1M tokens
      const RATE_TEXT_OUTPUT = 16.0 / 1_000_000; // $16.00 per 1M tokens
      const RATE_AUDIO_INPUT = 32.0 / 1_000_000; // $32.00 per 1M tokens (音声モード)
      const RATE_AUDIO_OUTPUT = 64.0 / 1_000_000; // $64.00 per 1M tokens (音声モード)

      // USD → JPY 換算レート
      const USD_TO_JPY = 154;

      const textInputCost = inputTokens * RATE_TEXT_INPUT;
      const textOutputCost = outputTokens * RATE_TEXT_OUTPUT;
      const audioInputCost = inputAudioTokens * RATE_AUDIO_INPUT;
      const audioOutputCost = outputAudioTokens * RATE_AUDIO_OUTPUT;

      const totalCostUSD =
        textInputCost + textOutputCost + audioInputCost + audioOutputCost;
      const totalCostJPY = totalCostUSD * USD_TO_JPY;

      return {
        textInputCost,
        textOutputCost,
        audioInputCost,
        audioOutputCost,
        totalCostUSD,
        totalCostJPY,
      };
    },
    []
  );

  /**
   * リアルタイムAI接続開始（WebRTC）
   */
  const connect = useCallback(
    async (sessionId: string) => {
      try {
        console.log("Starting WebRTC connection to OpenAI Realtime API...");

        // 1. サーバーから一時トークンと設定を取得
        const tokenResponse = await fetch("/api/realtime/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meetingId, sessionId }),
        });

        if (!tokenResponse.ok) {
          throw new Error("Failed to get token");
        }

        const {
          openaiEphemeralKey,
          meetingTitle,
          outputMode,
        }: {
          openaiEphemeralKey: string;
          meetingTitle: string;
          outputMode: OutputMode;
        } = await tokenResponse.json();

        if (!openaiEphemeralKey) {
          throw new Error("Failed to get OpenAI ephemeral key");
        }

        console.log("Ephemeral key obtained, output mode:", outputMode);

        // 2. RTCPeerConnection作成
        const pc = new RTCPeerConnection();

        // 3. マイクから音声ストリーム取得
        console.log("Requesting microphone access...");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 24000, // OpenAI推奨
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

        // 4. 音声トラックをPeerConnectionに追加
        const audioTrack = stream.getTracks()[0];
        pc.addTrack(audioTrack, stream);
        console.log("Audio track added to peer connection");

        // 5. 音声出力用のaudio要素作成
        if (outputMode === "audio" || outputMode === "text_audio") {
          const audioEl = document.createElement("audio");
          audioEl.autoplay = true;
          audioElementRef.current = audioEl;

          pc.ontrack = (e) => {
            console.log("Received remote audio track");
            audioEl.srcObject = e.streams[0];
          };
        }

        // 6. データチャネル作成（イベント送受信用）
        const dc = pc.createDataChannel("oai-events");
        dataChannelRef.current = dc;

        dc.onopen = () => {
          console.log("Data channel opened");

          // セッション設定を送信
          const sessionConfig = {
            type: "session.update",
            session: {
              modalities:
                outputMode === "text"
                  ? ["text"]
                  : outputMode === "audio"
                    ? ["audio"]
                    : ["text", "audio"],
              instructions: `あなたは会議のAIアシスタント「Miton」です。

【言語設定】
必ず日本語のみで応答してください。英語や他の言語を使用しないでください。

会議タイトル: ${meetingTitle}

【重要】あなたは会議の「1参加者」として振る舞います。常に発言するのではなく、必要な時だけ発言してください。

【発言条件（厳守）】
以下の場合のみ発言してください：

1. 直接呼ばれた時
   - 「Miton」「AI」「アシスタント」と呼ばれた時
   - 例：「Mitonさん、どう思いますか？」

2. 要約・整理を依頼された時
   - 「まとめて」「整理して」「要約して」と言われた時
   - 参加者の話が30秒以上続いた後、「要約しましょうか？」と提案可能

3. 質問を受けた時
   - 「どう思う？」「意見は？」などの質問形式

4. 議論が停滞している時
   - 10秒以上沈黙が続いた場合、議論を促す質問を投げかける
   - 例：「この点について、皆さんのご意見はいかがでしょうか？」

5. 明確な誤りや矛盾を検出した時
   - 重要な事実誤認がある場合のみ、丁寧に訂正提案

【絶対禁止事項】
❌ 上記条件以外での自発的発言
❌ 相槌や挨拶（「なるほど」「分かりました」等）
❌ 参加者同士の会話への割り込み
❌ 連続発言（前回発言から最低2分空ける）
❌ 長い説明（20秒以内に収める）

【発言スタイル】
- 簡潔（20秒以内）
- 補助的な立場を保つ
- 具体的なデータや事例を交えて
- 「〜と思います」ではなく「〜です」と断定的に

あなたは会議の邪魔をしない、賢い補助者です。`,
              voice: "alloy",
              input_audio_format: "pcm16",
              output_audio_format: "pcm16",
              input_audio_transcription: {
                model: "whisper-1",
              },
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                silence_duration_ms: 700, // ユーザーが話し終わったと判定するまでの沈黙時間
                create_response: false, // 自動応答OFF（ゲーティングロジックで制御）
              },
            },
          };

          dc.send(JSON.stringify(sessionConfig));
          console.log("Session config sent:", sessionConfig);
        };

        dc.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleRealtimeEvent(data);
          } catch (err) {
            console.error("Failed to parse data channel message:", err);
          }
        };

        dc.onerror = (error) => {
          console.error("Data channel error:", error);
        };

        dc.onclose = () => {
          console.log("Data channel closed");
        };

        // 7. SDP Offer作成
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log("SDP offer created");

        // 8. OpenAI Realtime APIにSDP Offerを送信
        console.log("Sending SDP offer to OpenAI...");
        const sdpResponse = await fetch(
          "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openaiEphemeralKey}`,
              "Content-Type": "application/sdp",
            },
            body: offer.sdp,
          }
        );

        if (!sdpResponse.ok) {
          const errorText = await sdpResponse.text();
          throw new Error(`SDP exchange failed: ${errorText}`);
        }

        // 9. SDP Answerを受け取って設定
        const answerSdp = await sdpResponse.text();
        const answer: RTCSessionDescriptionInit = {
          type: "answer",
          sdp: answerSdp,
        };
        await pc.setRemoteDescription(answer);
        console.log("SDP answer received and set");

        // 10. 接続状態監視
        pc.oniceconnectionstatechange = () => {
          console.log("ICE connection state:", pc.iceConnectionState);
          if (pc.iceConnectionState === "connected") {
            setIsConnected(true);
          } else if (
            pc.iceConnectionState === "failed" ||
            pc.iceConnectionState === "disconnected"
          ) {
            setIsConnected(false);
          }
        };

        pc.onconnectionstatechange = () => {
          console.log("Connection state:", pc.connectionState);
        };

        peerConnectionRef.current = pc;
        console.log("WebRTC connection established");
      } catch (err: any) {
        console.error("Failed to connect Realtime AI:", err);
        setError(err.message);
        throw err;
      }
    },
    [meetingId, onTranscript, onAIResponse]
  );

  /**
   * AI応答をトリガー
   */
  const triggerAIResponse = useCallback(
    (reason: string, context?: string) => {
      console.log("🤖 Triggering AI response:", reason);

      if (!dataChannelRef.current) {
        console.error("Data channel not ready");
        return;
      }

      // コンテキストがある場合は、会話アイテムとして追加
      if (context) {
        console.log("Adding conversation context:", context);
        dataChannelRef.current.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `【直近の会話】\n${context}\n\n上記の会話を踏まえて、適切にコメントしてください。`,
                },
              ],
            },
          })
        );
      }

      // response.createイベントを送信
      dataChannelRef.current.send(
        JSON.stringify({
          type: "response.create",
        })
      );

      lastAIResponseTimeRef.current = Date.now();
    },
    []
  );

  /**
   * ゲーティングロジック: AIが発言すべきか判定
   */
  const analyzeAndTriggerResponse = useCallback(
    (transcript: string, speaker: string) => {
      console.log("Analyzing transcript for trigger:", { transcript, speaker });

      // 最後のAI応答から2分以内は発言しない
      const timeSinceLastResponse = Date.now() - lastAIResponseTimeRef.current;
      if (timeSinceLastResponse < 120000) {
        console.log("Skip: Too soon after last AI response");
        return false;
      }

      const lowerTranscript = transcript.toLowerCase();

      // 条件1: 直接指名
      if (
        transcript.includes("Miton") ||
        transcript.includes("miton") ||
        lowerTranscript.includes("ai") ||
        transcript.includes("アシスタント")
      ) {
        console.log("✅ Trigger: Direct call detected");
        triggerAIResponse("direct_call");
        return true;
      }

      // 条件2: 要約依頼
      if (
        transcript.includes("まとめ") ||
        transcript.includes("整理") ||
        transcript.includes("要約")
      ) {
        console.log("✅ Trigger: Summary request detected");
        triggerAIResponse("summary_request");
        return true;
      }

      // 条件3: 質問形式
      if (
        transcript.includes("？") ||
        transcript.includes("どう思") ||
        transcript.includes("意見") ||
        transcript.includes("考え")
      ) {
        console.log("✅ Trigger: Question detected");
        triggerAIResponse("question");
        return true;
      }

      // 条件4: 発言時間追跡（30秒以上の長い発言）
      const speakerStartTime = speakerStartTimeRef.current[speaker];
      if (speakerStartTime) {
        const speakingDuration = Date.now() - speakerStartTime;
        if (speakingDuration > 30000) {
          console.log("✅ Trigger: Long speech (>30s), offer summary");
          triggerAIResponse("long_speech");
          speakerStartTimeRef.current[speaker] = Date.now(); // リセット
          return true;
        }
      } else {
        // 話者の発言開始時刻を記録
        speakerStartTimeRef.current[speaker] = Date.now();
      }

      console.log("Skip: No trigger condition met");
      return false;
    },
    [triggerAIResponse]
  );

  /**
   * 沈黙検出タイマーを開始
   */
  const startSilenceTimer = useCallback(() => {
    // 既存のタイマーをクリア
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    // 10秒後に沈黙チェック
    silenceTimerRef.current = setTimeout(() => {
      const silenceDuration = Date.now() - lastSpeechTimeRef.current;

      if (silenceDuration >= 10000) {
        console.log("✅ Trigger: Silence detected (>10s)");

        // 直近の会話をコンテキストとして渡す
        const recentConversation = conversationHistoryRef.current
          .slice(-5) // 最新5件
          .map((t) => `${t.speaker}: ${t.text}`)
          .join("\n");

        if (recentConversation) {
          triggerAIResponse("silence", recentConversation);
        } else {
          triggerAIResponse("silence");
        }
      }
    }, 10000);
  }, [triggerAIResponse]);

  /**
   * OpenAI Realtime APIイベント処理
   */
  const handleRealtimeEvent = useCallback(
    (event: any) => {
      console.log("Realtime event:", event.type, event);

      switch (event.type) {
        case "session.created":
          console.log("Session created:", event.session);
          break;

        case "session.updated":
          console.log("Session updated:", event.session);
          break;

        case "conversation.item.input_audio_transcription.completed":
          // 音声入力の文字起こし完了
          const transcript: Transcript = {
            id: event.item_id,
            speaker: "Speaker 1", // TODO: 話者識別
            text: event.transcript,
            timestamp: new Date().toISOString(),
            isFinal: true,
          };
          console.log("Transcription completed:", transcript);
          onTranscript(transcript);

          // 会話履歴に追加（最新10件まで保持）
          conversationHistoryRef.current = [
            ...conversationHistoryRef.current.slice(-9), // 最新9件を保持
            transcript,
          ];

          // 発言があったので、最後の発言時刻を更新
          lastSpeechTimeRef.current = Date.now();

          // ゲーティングロジックを実行
          analyzeAndTriggerResponse(event.transcript, transcript.speaker);

          // 沈黙検出タイマーを開始
          startSilenceTimer();
          break;

        case "response.audio_transcript.delta":
          // AI応答のテキスト（ストリーミング）
          console.log("AI response text delta:", event.delta);
          break;

        case "response.audio_transcript.done":
          // AI応答のテキスト完了
          const aiResponse: AIResponse = {
            text: event.transcript,
            timestamp: new Date().toISOString(),
          };
          console.log("AI response completed:", aiResponse);
          onAIResponse(aiResponse);
          break;

        case "response.done":
          console.log("Response done:", event);

          // 使用量情報を取得
          if (event.response?.usage) {
            const usage = event.response.usage;
            console.log("📊 Response Usage:", usage);

            // 累積使用量を更新
            usageRef.current.totalInputTokens += usage.input_tokens || 0;
            usageRef.current.totalOutputTokens += usage.output_tokens || 0;
            usageRef.current.totalInputAudioTokens +=
              usage.input_token_details?.audio_tokens || 0;
            usageRef.current.totalOutputAudioTokens +=
              usage.output_token_details?.audio_tokens || 0;
            usageRef.current.responseCount += 1;

            // 料金計算
            const cost = calculateCost(
              usage.input_tokens || 0,
              usage.output_tokens || 0,
              usage.input_token_details?.audio_tokens || 0,
              usage.output_token_details?.audio_tokens || 0
            );

            usageRef.current.totalCostUSD += cost.totalCostUSD;
            usageRef.current.totalCostJPY += cost.totalCostJPY;

            // このレスポンスの詳細をログ出力
            console.log(`💰 このレスポンスの料金:
  - テキスト入力: ${usage.input_token_details?.text_tokens || 0} tokens ($${cost.textInputCost.toFixed(6)} / ¥${(cost.textInputCost * 154).toFixed(2)})
  - テキスト出力: ${usage.output_token_details?.text_tokens || 0} tokens ($${cost.textOutputCost.toFixed(6)} / ¥${(cost.textOutputCost * 154).toFixed(2)})
  - 音声入力: ${usage.input_token_details?.audio_tokens || 0} tokens ($${cost.audioInputCost.toFixed(6)} / ¥${(cost.audioInputCost * 154).toFixed(2)})
  - 音声出力: ${usage.output_token_details?.audio_tokens || 0} tokens ($${cost.audioOutputCost.toFixed(6)} / ¥${(cost.audioOutputCost * 154).toFixed(2)})
  - 合計: $${cost.totalCostUSD.toFixed(6)} / ¥${cost.totalCostJPY.toFixed(2)}`);

            // セッション累積料金をログ出力
            console.log(`💵 セッション累積料金:
  - 総入力トークン: ${usageRef.current.totalInputTokens.toLocaleString()}
  - 総出力トークン: ${usageRef.current.totalOutputTokens.toLocaleString()}
  - 総音声入力トークン: ${usageRef.current.totalInputAudioTokens.toLocaleString()}
  - 総音声出力トークン: ${usageRef.current.totalOutputAudioTokens.toLocaleString()}
  - AI応答回数: ${usageRef.current.responseCount}
  - 累積費用: $${usageRef.current.totalCostUSD.toFixed(4)} USD (¥${usageRef.current.totalCostJPY.toFixed(0)} 円)`);
          }
          break;

        case "error":
          console.error("Realtime API error:", event.error);
          setError(event.error.message);
          break;
      }
    },
    [onTranscript, onAIResponse, analyzeAndTriggerResponse, startSilenceTimer]
  );

  /**
   * 接続終了
   */
  const disconnect = useCallback(() => {
    console.log("Disconnecting WebRTC...");

    // 最終的な料金サマリーを出力
    if (usageRef.current.responseCount > 0) {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║              セッション終了 - 料金サマリー                ║
╠═══════════════════════════════════════════════════════════╣
║ AI応答回数: ${usageRef.current.responseCount.toString().padEnd(43)}║
║ 総入力トークン: ${usageRef.current.totalInputTokens.toLocaleString().padEnd(39)}║
║ 総出力トークン: ${usageRef.current.totalOutputTokens.toLocaleString().padEnd(39)}║
║ 総音声入力トークン: ${usageRef.current.totalInputAudioTokens.toLocaleString().padEnd(35)}║
║ 総音声出力トークン: ${usageRef.current.totalOutputAudioTokens.toLocaleString().padEnd(35)}║
╠═══════════════════════════════════════════════════════════╣
║ 💵 合計費用: $${usageRef.current.totalCostUSD.toFixed(4)} USD (¥${usageRef.current.totalCostJPY.toFixed(0)} 円)      ║
╚═══════════════════════════════════════════════════════════╝
      `);

      // 概算：1時間会議の場合の推定費用
      const sessionDurationMinutes =
        (Date.now() - lastSpeechTimeRef.current) / 60000;
      if (sessionDurationMinutes > 0) {
        const costPerHourUSD =
          (usageRef.current.totalCostUSD / sessionDurationMinutes) * 60;
        const costPerHourJPY =
          (usageRef.current.totalCostJPY / sessionDurationMinutes) * 60;
        console.log(
          `📈 推定: 1時間会議の場合 約 $${costPerHourUSD.toFixed(2)} USD (¥${costPerHourJPY.toFixed(0)} 円)`
        );
      }
    }

    // 沈黙検出タイマーをクリア
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.srcObject = null;
      audioElementRef.current = null;
    }

    setIsConnected(false);

    // 使用量をリセット
    usageRef.current = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalInputAudioTokens: 0,
      totalOutputAudioTokens: 0,
      totalCostUSD: 0,
      totalCostJPY: 0,
      responseCount: 0,
    };
  }, []);

  return {
    connect,
    disconnect,
    isConnected,
    error,
  };
}
