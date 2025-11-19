/**
 * SSE（Server-Sent Events）文字起こし配信API
 *
 * Google Cloud Speech-to-Text v2 からの文字起こし結果を
 * SSEでクライアントにリアルタイム配信する
 */

import { v2 } from "@google-cloud/speech";
import { NextRequest } from "next/server";
import { sessionStore } from "@/lib/google-ai/stt-session";
import { STT_CONFIG, GOOGLE_CLOUD_CONFIG } from "@/lib/google-ai/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get("sessionId");
  const meetingId = searchParams.get("meetingId");

  console.log('[STT Stream] 🎤 New connection request', {
    sessionId,
    meetingId,
    url: request.url,
  });

  if (!sessionId || !meetingId) {
    console.error('[STT Stream] ❌ Missing parameters', { sessionId, meetingId });
    return new Response("Missing sessionId or meetingId", { status: 400 });
  }

  // 認証情報の確認
  if (!GOOGLE_CLOUD_CONFIG.projectId || !GOOGLE_CLOUD_CONFIG.recognizer) {
    return new Response("Google Cloud configuration is missing", {
      status: 500,
    });
  }

  // SSEストリーム作成
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let isControllerClosed = false;

      // controllerが閉じられたかを追跡
      const safeEnqueue = (data: Uint8Array) => {
        if (!isControllerClosed) {
          try {
            controller.enqueue(data);
          } catch (error) {
            isControllerClosed = true;
            console.error("[STT Stream] Controller enqueue error", error);
          }
        }
      };

      const setupTimerLabel = `[STT Stream] Setup total ${sessionId}`;
      let setupTimerEnded = false;
      console.time(setupTimerLabel);

      try {

        // Google STT V2 client作成（絶対パスを使用）
        const credentialsPath = path.resolve(
          process.cwd(),
          GOOGLE_CLOUD_CONFIG.credentialsPath
        );
        console.log("[STT Stream] Using credentials from:", credentialsPath);

        const clientTimerLabel = `[STT Stream] SpeechClient V2 init ${sessionId}`;
        console.time(clientTimerLabel);

        // プロジェクトIDを取得
        const projectId = GOOGLE_CLOUD_CONFIG.projectId;

        // 言語交換モードかどうかで使用するRecognizerを切り替え
        const isLanguageExchange = meetingId?.startsWith('language-exchange-');

        let REGION: string;
        let API_ENDPOINT: string;
        let recognizerPath: string;

        if (isLanguageExchange) {
          // 言語交換: chirp_3モデルで多言語対応
          REGION = 'eu';
          API_ENDPOINT = `${REGION}-speech.googleapis.com`;

          // meetingIdから言語コードを抽出 (例: language-exchange-fi → fi)
          const langCode = meetingId.replace('language-exchange-', '');

          // 言語コードからRecognizerへのマッピング
          const recognizerMap: { [key: string]: string } = {
            'sv': 'lang-sw',  // スウェーデン語
            'fi': 'lang-fi',  // フィンランド語
            'it': 'lang-it',  // イタリア語
            'de': 'lang-de',  // ドイツ語
            'tr': 'lang-tr',  // トルコ語
          };

          const recognizerId = recognizerMap[langCode];
          if (!recognizerId) {
            throw new Error(`Unsupported language code: ${langCode}`);
          }

          recognizerPath = `projects/${projectId}/locations/${REGION}/recognizers/${recognizerId}`;
        } else {
          // 会議: 日本語のみ + 話者識別（chirp_3モデル、1-5人）
          REGION = 'asia-northeast1';
          API_ENDPOINT = `${REGION}-speech.googleapis.com`;
          recognizerPath = `projects/${projectId}/locations/${REGION}/recognizers/meeting-ja-diarization`;
        }

        const speechClient = new v2.SpeechClient({
          keyFilename: credentialsPath,
          apiEndpoint: API_ENDPOINT,  // Recognizerの地域に合わせる
        });
        console.timeEnd(clientTimerLabel);

        console.log("[STT Stream] Using recognizer:", {
          mode: isLanguageExchange ? 'language-exchange' : 'meeting',
          recognizerPath,
          region: REGION,
          apiEndpoint: API_ENDPOINT,
        });

        console.log("[STT Stream] Creating streaming recognize request", {
          sessionId,
          meetingId,
        });

        // STT V2 ストリーミング認識開始
        // 音声フォーマット: LINEAR16（AudioWorkletでPCM16を送信）

        // 言語交換モードの場合は多言語認識を有効化
        let languageCodes: string[] = [];

        if (isLanguageExchange) {
          // meetingIdから相手の言語を抽出 (例: language-exchange-sv → sv)
          const partnerLangCode = meetingId.replace('language-exchange-', '');

          // 言語コードをSTT用のロケールコードに変換
          const languageCodeMap: { [key: string]: string } = {
            'sv': 'sv-SE',
            'en': 'en-US',
            'ko': 'ko-KR',
            'zh': 'zh-CN',
            'es': 'es-ES',
            'fr': 'fr-FR',
            'de': 'de-DE',
            'it': 'it-IT',
            'pt': 'pt-PT',
            'ru': 'ru-RU',
            'tr': 'tr-TR',
            'th': 'th-TH',
            'vi': 'vi-VN',
          };

          const partnerLocaleCode = languageCodeMap[partnerLangCode] || partnerLangCode;

          // 英語、日本語、相手の言語の3つを認識（V2: 配列で指定）
          // 相手の言語が英語の場合は重複を避けるため、filterで除外
          languageCodes = ['en-US', 'ja-JP', partnerLocaleCode].filter(
            (code, index, self) => code && self.indexOf(code) === index // 重複除去
          );

          console.log("[STT Stream] 🌐 Multi-language mode enabled (V2):", {
            languageCodes,
            partnerLanguage: partnerLangCode,
            partnerLocaleCode,
          });
        } else {
          // 通常モード（日本語のみ）
          languageCodes = ['ja-JP'];
        }

        // V2 RecognitionConfig
        // Recognizerには既にmodelとlanguageCodesが設定されているため、
        // ここでは音声エンコーディングとfeaturesのみ指定
        const recognitionConfig = {
          explicitDecodingConfig: {
            encoding: "LINEAR16",
            sampleRateHertz: 16000,
            audioChannelCount: 1,
          },
          features: {
            enableAutomaticPunctuation: true,
          },
        };

        // V2 StreamingRecognitionConfig
        const streamingConfig = {
          config: recognitionConfig,
          streamingFeatures: {
            interimResults: true,  // 中間結果を取得
          },
        };

        // V2 初期リクエスト（configのみ）
        const configRequest = {
          recognizer: recognizerPath,
          streamingConfig: streamingConfig,
        };

        console.log("[STT Stream] Initializing STT V2 stream with config:", {
          mode: isLanguageExchange ? 'language-exchange' : 'meeting',
          recognizer: recognizerPath,
          region: REGION,
          apiEndpoint: API_ENDPOINT,
          encoding: "LINEAR16",
          sampleRateHertz: 16000,
          note: "Model and languageCodes are configured in the Recognizer",
        });

        const streamTimerLabel = `[STT Stream] streamingRecognize V2 ${sessionId}`;
        console.time(streamTimerLabel);

        // V2 ストリームを作成（Node.jsでは _streamingRecognize を使用）
        const sttStream = speechClient._streamingRecognize();

        // 最初にconfigを送信
        sttStream.write(configRequest);

        console.timeEnd(streamTimerLabel);

        console.log("[STT Stream] STT stream created, waiting for data...");

        // セッション登録
        sessionStore.set(sessionId, {
          sttStream,
          controller,
          createdAt: new Date(),
        });

        console.log("[STT Stream] Session registered", { sessionId });

        // クライアントへ初期化完了通知
        safeEnqueue(encoder.encode("event: ready\ndata: {}\n\n"));
        console.timeEnd(setupTimerLabel);
        setupTimerEnded = true;

        // STT結果をSSEで送信
        sttStream.on("data", async (data: any) => {
          try {
            const result = data.results?.[0];

            console.log("[STT Stream] 📥 Received data from STT:", {
              hasResults: !!data.results,
              resultsLength: data.results?.length,
              hasResult: !!result,
              isFinal: result?.isFinal,
              resultEndOffset: result?.resultEndOffset,
              rawDataSnippet: JSON.stringify(data).substring(0, 300),
            });

            if (!result) {
              console.log("[STT Stream] ⚠️  No results in data, skipping");
              return;
            }

            const event = result.isFinal ? "final" : "partial";
            const transcript = result.alternatives?.[0]?.transcript || "";
            const confidence = result.alternatives?.[0]?.confidence || 0;
            const detectedLanguage = result.languageCode || "unknown"; // 認識された言語

            // 話者識別結果を取得（会議モードで有効）
            // V2 APIでは alternatives[0].words に各単語の情報が含まれ、speakerLabel が付与される
            const words = result.alternatives?.[0]?.words || [];
            const speakerLabel = words.length > 0 && words[0].speakerLabel
              ? `Speaker ${words[0].speakerLabel}`
              : "Speaker 0"; // 不明・識別不可

            console.log("[STT Stream] 📝 Parsed result:", {
              event,
              isFinal: result.isFinal,
              transcript: transcript.substring(0, 100),
              confidence,
              detectedLanguage, // どの言語として認識されたか
              hasTranscript: !!transcript,
              speakerLabel, // 話者ラベルをログに追加
              wordsCount: words.length,
            });

            const sseData = `event: ${event}\ndata: ${JSON.stringify({
              id: `transcript-${Date.now()}`,
              text: transcript,
              speaker: speakerLabel,
              confidence: confidence,
              timestamp: new Date().toISOString(),
              startTime: result.resultEndOffset?.seconds || 0,
              endTime: result.resultEndOffset?.nanos || 0,
            })}\n\n`;

            safeEnqueue(encoder.encode(sseData));

            console.log("[STT Stream] Transcript sent", {
              sessionId,
              event,
              text: transcript.substring(0, 50),
            });

            // Final結果の場合、transcriptsテーブルに保存
            console.log('[STT Stream] 💾 Checking if should save to DB:', {
              isFinal: result.isFinal,
              hasTranscript: !!transcript,
              transcriptLength: transcript?.length,
              trimmedLength: transcript?.trim().length,
            });

            if (result.isFinal && transcript.trim()) {
              console.log('[STT Stream] ✅ Conditions met, saving to DB...', {
                meetingId,
                sessionId,
                text: transcript.substring(0, 100),
                speaker: speakerLabel,
              });

              try {
                const supabase = await getSupabaseServerClient();

                const dataToInsert = {
                  meeting_id: meetingId,
                  session_id: sessionId,
                  text: transcript,
                  confidence: confidence,
                  language: 'ja-JP',
                  speaker_label: speakerLabel,
                  start_time: result.resultEndOffset?.seconds || 0,
                  end_time: (result.resultEndOffset?.seconds || 0) + (result.resultEndOffset?.nanos || 0) / 1e9,
                  audio_duration: (result.resultEndOffset?.nanos || 0) / 1e9,
                };

                console.log('[STT Stream] 📤 Inserting data:', dataToInsert);

                const { data: insertedData, error: insertError } = await supabase
                  .from('transcripts')
                  .insert(dataToInsert)
                  .select();

                if (insertError) {
                  console.error('[STT Stream] ❌ Failed to save transcript to DB:', {
                    error: insertError,
                    message: insertError.message,
                    details: insertError.details,
                    hint: insertError.hint,
                    code: insertError.code,
                  });
                } else {
                  console.log('[STT Stream] ✅ Transcript saved successfully to DB', {
                    insertedData,
                    sessionId,
                    meetingId,
                    text: transcript.substring(0, 50),
                  });
                }
              } catch (dbError) {
                console.error('[STT Stream] ❌ Exception saving transcript to DB:', dbError);
              }
            } else {
              console.log('[STT Stream] ⏭️  Skipping DB save (not final or empty)');
            }
          } catch (error) {
            console.error("[STT Stream] Error processing data", error);
          }
        });

        // エラーハンドリング
        sttStream.on("error", (error: any) => {
          console.error("[STT Stream] STT stream error", {
            sessionId,
            error: error.message,
            code: error.code,
            details: error.details,
            metadata: error.metadata,
          });

          const errorData = `event: error\ndata: ${JSON.stringify({
            message: error.message || "STT stream error",
            code: error.code,
          })}\n\n`;

          safeEnqueue(encoder.encode(errorData));
        });

        // STT stream終了
        sttStream.on("end", () => {
          console.log("[STT Stream] STT stream ended", { sessionId });
        });

        // STT stream閉じられた
        sttStream.on("close", () => {
          console.log("[STT Stream] STT stream closed", { sessionId });
        });

        // ハートビート（30秒ごと）
        const heartbeat = setInterval(() => {
          safeEnqueue(encoder.encode("event: ping\ndata: {}\n\n"));
          if (isControllerClosed) {
            clearInterval(heartbeat);
          }
        }, 30000);

        // クリーンアップ
        request.signal.addEventListener("abort", () => {
          console.log("[STT Stream] Client disconnected", { sessionId });

          isControllerClosed = true;
          clearInterval(heartbeat);

          try {
            sttStream.end();
          } catch (error) {
            console.error("[STT Stream] Error ending stream", error);
          }

          sessionStore.delete(sessionId);

          try {
            controller.close();
          } catch (error) {
            console.error("[STT Stream] Error closing controller", error);
          }
        });
      } catch (error) {
        if (!setupTimerEnded) {
          console.timeEnd(setupTimerLabel);
        }
        console.error("[STT Stream] Initialization error", error);

        const errorData = `event: error\ndata: ${JSON.stringify({
          message:
            error instanceof Error ? error.message : "Initialization failed",
        })}\n\n`;

        safeEnqueue(encoder.encode(errorData));
        isControllerClosed = true;
        try {
          controller.close();
        } catch (closeError) {
          console.error("[STT Stream] Error closing controller", closeError);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Nginxバッファリング無効化
    },
  });
}
