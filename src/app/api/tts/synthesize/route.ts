/**
 * TTS音声合成API
 *
 * テキストをGoogle Cloud Text-to-Speechで音声に変換
 */

import { NextRequest, NextResponse } from "next/server";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { TTS_CONFIG, GOOGLE_CLOUD_CONFIG } from "@/lib/google-ai/config";
import path from "path";

export const runtime = "nodejs";

type RequestBody = {
  text: string;
  voice?: string;
  speed?: number;
  pitch?: number;
};

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const {
      text,
      voice = TTS_CONFIG.voice.name,
      speed = 1.0,
      pitch = 0.0,
    } = body;

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // TTS client作成（絶対パスを使用）
    const credentialsPath = path.resolve(
      process.cwd(),
      GOOGLE_CLOUD_CONFIG.credentialsPath
    );
    const ttsClient = new TextToSpeechClient({
      keyFilename: credentialsPath,
    });

    console.log("[TTS] Synthesizing speech", {
      textLength: text.length,
      voice,
      speed,
      pitch,
    });

    // SSML生成（抑揚とポーズを追加）
    const ssml = `<speak>
      <prosody rate="${speed}" pitch="${pitch}st">
        ${escapeSSML(text)}
        <break time="300ms"/>
      </prosody>
    </speak>`;

    // 音声合成リクエスト
    const [response] = await ttsClient.synthesizeSpeech({
      input: { ssml },
      voice: {
        languageCode: TTS_CONFIG.voice.languageCode,
        name: voice,
        ssmlGender: TTS_CONFIG.voice.ssmlGender,
      },
      audioConfig: {
        audioEncoding: TTS_CONFIG.audioConfig.audioEncoding,
        sampleRateHertz: TTS_CONFIG.audioConfig.sampleRateHertz,
        speakingRate: speed,
        pitch: pitch,
      },
    });

    if (!response.audioContent) {
      throw new Error("No audio content in response");
    }

    // Base64エンコード
    const audioBase64 = Buffer.from(response.audioContent).toString("base64");

    // 音声時間の推定（文字数から）
    const estimatedDuration = estimateAudioDuration(text, speed);

    console.log("[TTS] Speech synthesized", {
      audioSize: response.audioContent.length,
      duration: estimatedDuration,
      characterCount: text.length,
    });

    return NextResponse.json({
      audioContent: audioBase64,
      duration: estimatedDuration,
      characterCount: text.length,
      encoding: TTS_CONFIG.audioConfig.audioEncoding,
      sampleRate: TTS_CONFIG.audioConfig.sampleRateHertz,
    });
  } catch (error) {
    console.error("[TTS] Synthesis error", error);

    return NextResponse.json(
      {
        error: "Failed to synthesize speech",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * SSMLエスケープ
 */
function escapeSSML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * 音声時間の推定
 * 日本語: 約7.5文字/秒
 */
function estimateAudioDuration(text: string, speed: number): number {
  const charactersPerSecond = 7.5 * speed;
  return Math.ceil(text.length / charactersPerSecond);
}
