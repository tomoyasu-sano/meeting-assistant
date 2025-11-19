import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json(
      { error: "Query parameter is required" },
      { status: 400 }
    );
  }

  // モックデータを返す
  const mockResults = {
    query,
    results: [
      {
        title: `${query}に関する最新情報`,
        snippet: `${query}についての詳細な情報がここに表示されます。これはモックデータです。`,
        url: `https://example.com/search?q=${encodeURIComponent(query)}`,
        publishedDate: new Date().toISOString(),
      },
      {
        title: `${query}の活用方法`,
        snippet: `実際の検索エンジンでは、${query}に関連する複数のWebページが表示されます。`,
        url: `https://example.com/articles/${encodeURIComponent(query)}`,
        publishedDate: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        title: `${query}とは何か？`,
        snippet: `${query}の基本的な説明と、実際の使用例について解説しています。`,
        url: `https://example.com/wiki/${encodeURIComponent(query)}`,
        publishedDate: new Date(Date.now() - 172800000).toISOString(),
      },
    ],
    timestamp: new Date().toISOString(),
    source: "mock-search-engine",
  };

  return NextResponse.json(mockResults);
}
