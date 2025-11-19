/**
 * モック API: 過去の会議サマリー取得
 *
 * Function Calling のテスト用にダミーデータを返す
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const limit = parseInt(searchParams.get("limit") || "1", 10);

    console.log("[Mock API] 過去会議検索:", { query, limit });

    // クエリに応じて異なるモックデータを返す
    const mockMeetings = generateMockMeetings(query, limit);

    const response = {
      meetings: mockMeetings,
      totalCount: mockMeetings.length,
      query,
    };

    console.log("[Mock API] Response:", response);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Mock API] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to get mock data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function generateMockMeetings(query: string, limit: number) {
  const meetings = [];

  // クエリに応じて異なるパターンを返す
  const patterns = [
    {
      keywords: ["前回", "最近", "直近"],
      data: {
        title: "前回のケアプラン会議",
        date: "2025-02-10",
        participants: ["山田太郎", "佐藤花子", "鈴木一郎"],
        summary: "利用者の介護方針の確認と担当割り当てを決定しました。リハビリ計画の見直しも行いました。",
        decisions: [
          "訪問リハビリを週2回へ増加することを決定",
          "次回は 3/5 に進捗確認を実施",
          "家族への報告書は佐藤さんが担当"
        ]
      }
    },
    {
      keywords: ["財務", "予算", "コスト"],
      data: {
        title: "施設運営費用検討会議",
        date: "2025-02-05",
        participants: ["田中部長", "山田太郎", "高橋課長"],
        summary: "来年度の予算配分と設備投資計画について議論しました。",
        decisions: [
          "新規設備購入の予算を500万円計上",
          "人件費の見直しを4月から実施",
          "光熱費削減の取り組みを強化"
        ]
      }
    },
    {
      keywords: ["福祉", "介護", "ケア"],
      data: {
        title: "介護サービス向上ミーティング",
        date: "2025-02-08",
        participants: ["鈴木主任", "佐藤花子", "中村さん"],
        summary: "利用者満足度向上のための新しいサービス導入について検討しました。",
        decisions: [
          "レクリエーション活動を週3回に増やす",
          "個別ケアプランの見直しを月1回実施",
          "家族との面談機会を増やす"
        ]
      }
    }
  ];

  // クエリにマッチするパターンを探す
  let selectedPattern = patterns[0]; // デフォルト
  for (const pattern of patterns) {
    if (pattern.keywords.some(keyword => query.includes(keyword))) {
      selectedPattern = pattern;
      break;
    }
  }

  // limit の数だけ会議データを生成
  for (let i = 0; i < limit; i++) {
    const meeting = { ...selectedPattern.data };

    // limit > 1 の場合は日付を少しずつ変える
    if (i > 0) {
      const date = new Date(meeting.date);
      date.setDate(date.getDate() - (i * 7)); // 1週間ずつ古くする
      meeting.date = date.toISOString().split('T')[0];
      meeting.title = `${meeting.title} (${i + 1}回前)`;
    }

    meetings.push(meeting);
  }

  return meetings;
}
