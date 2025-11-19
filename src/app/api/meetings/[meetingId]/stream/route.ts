import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server-Sent Events (SSE) で文字起こしをストリーミング
 * Stage 7: モックデータを使用
 * Stage 8: セッション管理統合
 */

// モック文字起こしデータ
const mockTranscripts = [
  { speaker: "山田太郎", text: "本日の会議を始めます。" },
  { speaker: "佐藤花子", text: "よろしくお願いします。" },
  { speaker: "山田太郎", text: "まず、前回の議事録を確認したいと思います。" },
  { speaker: "鈴木一郎", text: "前回の課題は全て完了しています。" },
  { speaker: "佐藤花子", text: "素晴らしいですね。次のステップに進みましょう。" },
  {
    speaker: "山田太郎",
    text: "では、今月の目標について話し合いたいと思います。",
  },
  {
    speaker: "鈴木一郎",
    text: "利用者数を20%増やすことを目標にしたいです。",
  },
  { speaker: "佐藤花子", text: "実現可能な目標だと思います。" },
  {
    speaker: "山田太郎",
    text: "それでは、その目標に向けてアクションプランを立てましょう。",
  },
  { speaker: "鈴木一郎", text: "マーケティング活動を強化する必要があります。" },
];

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await context.params;
  const supabase = await getSupabaseServerClient();

  // sessionIdをクエリパラメータから取得
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: "sessionId is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 認証確認
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 会議の存在確認（ホストのみアクセス可能）
  const { data: meeting } = await supabase
    .from("meetings")
    .select(
      `
      id,
      category:categories(user_id)
    `
    )
    .eq("id", meetingId)
    .single();

  if (!meeting || (meeting.category as any)?.user_id !== user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  // セッションの存在確認と状態チェック
  const { data: session } = await supabase
    .from("meeting_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .eq("meeting_id", meetingId)
    .single();

  if (!session) {
    return new Response(
      JSON.stringify({ error: "Session not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  if (session.status !== "active") {
    return new Response(
      JSON.stringify({
        error: "session_not_active",
        message: `セッションがアクティブではありません。現在のステータス: ${session.status}`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  let index = 0;
  let intervalId: NodeJS.Timeout;
  let startTime = Date.now();
  const MAX_SESSION_DURATION = 3 * 60 * 60 * 1000; // 3時間

  const stream = new ReadableStream({
    async start(controller) {
      // 接続確認メッセージ
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "connected", meetingId })}\n\n`
        )
      );

      // 2秒ごとにモック文字起こしを送信
      intervalId = setInterval(async () => {
        const elapsedTime = Date.now() - startTime;

        // 3時間経過チェック
        if (elapsedTime > MAX_SESSION_DURATION) {
          console.log("Session timeout: 3 hours exceeded");

          // セッションを自動終了
          await supabase
            .from("meeting_sessions")
            .update({
              status: "ended",
              ended_at: new Date().toISOString(),
            })
            .eq("id", sessionId);

          // クライアントに通知
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "timeout",
                message: "会議が3時間を超えたため自動終了しました",
              })}\n\n`
            )
          );

          clearInterval(intervalId);
          controller.close();
          return;
        }

        if (index >= mockTranscripts.length) {
          // 全てのモックデータを送信完了
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "end", message: "モックデータ送信完了" })}\n\n`
            )
          );
          clearInterval(intervalId);
          controller.close();
          return;
        }

        const mock = mockTranscripts[index];
        const elapsedSeconds = (Date.now() - startTime) / 1000; // 秒単位

        // transcriptsテーブルに保存
        const { data: transcript, error } = await supabase
          .from("transcripts")
          .insert({
            meeting_id: meetingId,
            session_id: sessionId,
            text: mock.text,
            start_time: elapsedSeconds,
            speaker_label: mock.speaker,
            confidence: 0.95, // モックの信頼度
            language: "ja",
          })
          .select()
          .single();

        if (error) {
          console.error("Failed to save transcript:", error);
        }

        // クライアントに送信
        const data = {
          type: "transcript",
          id: transcript?.id || `mock-${index}`,
          speaker: mock.speaker,
          text: mock.text,
          timestamp: new Date().toISOString(),
          startTime: elapsedSeconds,
        };

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );

        index++;
      }, 2000); // 2秒間隔
    },

    cancel() {
      // クライアントが接続を切断した場合
      if (intervalId) {
        clearInterval(intervalId);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Nginxのバッファリングを無効化
    },
  });
}
