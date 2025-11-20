"use client";

import { useState, useEffect, useRef } from "react";
import { TermExplanationPane, TermExplanationPaneRef, TermCard } from "@/components/TermExplanationPane";
import { HistoryTab } from "@/components/HistoryTab";
import { EvaluationTab } from "@/components/EvaluationTab";

type Transcript = {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  startTime?: number;
  isFinal?: boolean;
};

type AssistMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

type Session = {
  id: string;
  meeting_id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
};

export function ViewerSessionPanel({ meetingId }: { meetingId: string }) {
  // タブ切り替え状態
  const [activeTab, setActiveTab] = useState<'discussionAssist' | 'history' | 'evaluation' | 'terms' | 'transcripts'>('discussionAssist');

  // データ状態
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [assistMessages, setAssistMessages] = useState<AssistMessage[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'active' | 'paused' | 'ended'>('idle');
  const [industries, setIndustries] = useState<string[]>([]);

  // Term cards state (synced from TermExplanationPane for mobile display)
  const [termCards, setTermCards] = useState<TermCard[]>([]);

  // Refs
  const termPaneRef = useRef<TermExplanationPaneRef>(null);

  // 会議情報とアクティブセッションを取得
  useEffect(() => {
    fetchMeetingData();
    fetchActiveSession();
  }, [meetingId]);

  const fetchMeetingData = async () => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}`);
      if (response.ok) {
        const data = await response.json();
        setIndustries(data.meeting.industries || []);
      }
    } catch (error) {
      console.error("Failed to fetch meeting data:", error);
    }
  };

  const fetchActiveSession = async () => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}/sessions/active`);
      if (response.ok) {
        const data = await response.json();
        if (data.session) {
          setCurrentSession(data.session);
          setSessionStatus(data.session.status === 'ended' ? 'ended' : 'active');
          // アクティブセッションがあれば、データを取得
          fetchSessionData(data.session.id);
        } else {
          setSessionStatus('idle');
        }
      }
    } catch (error) {
      console.error("Failed to fetch active session:", error);
      setSessionStatus('idle');
    }
  };

  const fetchSessionData = async (sessionId: string) => {
    // 文字起こしを取得
    fetchTranscripts(sessionId);
    // 議論アシストメッセージを取得
    fetchAssistMessages(sessionId);
  };

  const fetchTranscripts = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}/sessions/${sessionId}/transcripts`);
      if (response.ok) {
        const data = await response.json();
        setTranscripts(data.transcripts || []);
      }
    } catch (error) {
      console.error("Failed to fetch transcripts:", error);
    }
  };

  const fetchAssistMessages = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}/ai-messages?sessionId=${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setAssistMessages(data.messages || []);
      }
    } catch (error) {
      console.error("Failed to fetch assist messages:", error);
    }
  };

  // リアルタイム更新（ポーリング）
  useEffect(() => {
    if (!currentSession) return;

    const interval = setInterval(() => {
      fetchTranscripts(currentSession.id);
      fetchAssistMessages(currentSession.id);
    }, 3000); // 3秒ごとに更新

    return () => clearInterval(interval);
  }, [currentSession]);

  return (
    <>
      <div className="flex h-screen w-full">
        {/* メインコンテンツエリア */}
        <div className="flex-1 overflow-auto p-4">
          {/* 閲覧モード表示 - セッション制御バーの代わり */}
          <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-6 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-lg">
                👁️
              </span>
              <div>
                <p className="font-semibold text-blue-900">
                  閲覧モード
                </p>
                <p className="text-sm text-blue-700">
                  この会議を閲覧しています。セッションの操作はできません。
                </p>
              </div>
              {sessionStatus === 'active' && (
                <span className="ml-auto inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
                  進行中
                </span>
              )}
            </div>
          </div>

          {/* タブバー */}
          <div className="sticky top-0 z-10 mb-4 backdrop-blur-sm bg-white/80 border-b border-zinc-200">
            <nav
              role="tablist"
              aria-label="会議コンテンツ"
              className="flex gap-2 px-2 pt-2"
            >
              <button
                role="tab"
                aria-selected={activeTab === 'discussionAssist'}
                aria-controls="discussion-assist-panel"
                onClick={() => setActiveTab('discussionAssist')}
                className={`
                  px-6 py-3 rounded-t-lg text-sm font-medium transition-all duration-150
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                  ${
                    activeTab === 'discussionAssist'
                      ? 'bg-white text-indigo-600 border-t-2 border-x-2 border-indigo-600 border-b-white'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                  }
                `}
              >
                議論アシスト
                {assistMessages.length > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-indigo-600 rounded-full">
                    {assistMessages.length}
                  </span>
                )}
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'history'}
                aria-controls="history-panel"
                onClick={() => setActiveTab('history')}
                className={`
                  px-6 py-3 rounded-t-lg text-sm font-medium transition-all duration-150
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                  ${
                    activeTab === 'history'
                      ? 'bg-white text-indigo-600 border-t-2 border-x-2 border-indigo-600 border-b-white'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                  }
                `}
              >
                過去履歴
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'evaluation'}
                aria-controls="evaluation-panel"
                onClick={() => setActiveTab('evaluation')}
                className={`
                  px-6 py-3 rounded-t-lg text-sm font-medium transition-all duration-150
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                  ${
                    activeTab === 'evaluation'
                      ? 'bg-white text-indigo-600 border-t-2 border-x-2 border-indigo-600 border-b-white'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                  }
                `}
              >
                会議評価
              </button>
              {/* モバイル専用タブ: 用語解説 (PCでは右ペインで表示) */}
              <button
                role="tab"
                aria-selected={activeTab === 'terms'}
                aria-controls="terms-panel"
                onClick={() => setActiveTab('terms')}
                className={`
                  lg:hidden px-6 py-3 rounded-t-lg text-sm font-medium transition-all duration-150
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                  ${
                    activeTab === 'terms'
                      ? 'bg-white text-indigo-600 border-t-2 border-x-2 border-indigo-600 border-b-white'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                  }
                `}
              >
                用語解説
              </button>
              {/* モバイル専用タブ: 文字起こし (PCでは右ペインで表示) */}
              <button
                role="tab"
                aria-selected={activeTab === 'transcripts'}
                aria-controls="transcripts-panel"
                onClick={() => setActiveTab('transcripts')}
                className={`
                  lg:hidden px-6 py-3 rounded-t-lg text-sm font-medium transition-all duration-150
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                  ${
                    activeTab === 'transcripts'
                      ? 'bg-white text-indigo-600 border-t-2 border-x-2 border-indigo-600 border-b-white'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                  }
                `}
              >
                文字起こし
              </button>
            </nav>
          </div>

          {/* タブパネル */}
          {activeTab === 'history' ? (
            <div className="h-[calc(100vh-180px)]">
              <HistoryTab meetingId={meetingId} />
            </div>
          ) : activeTab === 'evaluation' ? (
            <div className="h-[calc(100vh-180px)]">
              <EvaluationTab meetingId={meetingId} />
            </div>
          ) : activeTab === 'terms' ? (
            <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white h-[calc(100vh-180px)] lg:hidden">
              <div
                role="tabpanel"
                id="terms-panel"
                aria-labelledby="terms-tab"
                className="flex flex-col h-full"
              >
                <div className="border-b border-zinc-200 px-6 py-4">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900">
                      用語解説
                    </h2>
                    <p className="mt-1 text-sm text-zinc-600">
                      会議中に出た専門用語を自動で解説します
                    </p>
                  </div>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {termCards.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center">
                      <p className="text-sm text-zinc-500">
                        会議中に出た用語はこちらに表示されます
                      </p>
                    </div>
                  ) : (
                    termCards.map((card) => (
                      <div
                        key={card.id}
                        className="rounded-lg border border-indigo-200 bg-indigo-50 p-4"
                      >
                        <div className="flex items-start justify-between">
                          <h3 className="text-lg font-semibold text-indigo-900">
                            {card.term}
                          </h3>
                          <span className="text-xs text-zinc-500">
                            {new Date(card.timestamp).toLocaleTimeString("ja-JP")}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-zinc-700">
                          {card.description}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'transcripts' ? (
            <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white h-[calc(100vh-180px)] lg:hidden">
              <div
                role="tabpanel"
                id="transcripts-panel"
                aria-labelledby="transcripts-tab"
                className="flex flex-col h-full"
              >
                <div className="border-b border-zinc-200 px-6 py-4">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900">
                      文字起こし
                    </h2>
                    <p className="mt-1 text-sm text-zinc-600">
                      会議の発言がリアルタイムで表示されます
                    </p>
                  </div>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {transcripts.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center">
                      <p className="text-sm text-zinc-500">
                        会議中の発言はこちらに表示されます
                      </p>
                    </div>
                  ) : (
                    transcripts.map((transcript) => (
                      <div
                        key={transcript.id}
                        className={`rounded-lg border p-4 ${
                          transcript.isFinal
                            ? "border-blue-200 bg-blue-50"
                            : "border-zinc-200 bg-zinc-50"
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-semibold text-zinc-900">
                            {transcript.speaker}
                            {!transcript.isFinal && (
                              <span className="ml-2 text-xs text-zinc-500">
                                (認識中...)
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {transcript.startTime !== undefined
                              ? `${Math.floor(transcript.startTime / 60)}:${String(Math.floor(transcript.startTime % 60)).padStart(2, "0")}`
                              : ""}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-700">{transcript.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white h-[calc(100vh-180px)]">
              {/* 議論アシストパネル - 読み取り専用 */}
              <div
                role="tabpanel"
                id="discussion-assist-panel"
                aria-labelledby="discussion-assist-tab"
                className="flex flex-col h-full"
              >
                <div className="border-b border-zinc-200 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-zinc-900">
                        議論アシスト（閲覧専用）
                      </h2>
                      <p className="mt-1 text-sm text-zinc-600">
                        ホストのAI会話を閲覧できます。質問はホストを通じて行ってください。
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                      <span className="text-sm">👁️</span>
                      閲覧専用
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-6">
                  {assistMessages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center">
                      <div className="max-w-md">
                        <p className="text-sm text-zinc-500">
                          ホストがAIと会話を始めると、ここに表示されます
                        </p>
                        <p className="mt-2 text-xs text-zinc-400">
                          💡 質問がある場合は、ホストに伝えてAIに質問してもらいましょう
                        </p>
                      </div>
                    </div>
                  ) : (
                    assistMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                            message.role === "user"
                              ? "bg-indigo-600 text-white"
                              : "bg-zinc-100 text-zinc-900"
                          }`}
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <span className="text-xs font-medium opacity-75">
                              {message.role === "user" ? "ホスト" : "AI"}
                            </span>
                            <span className="text-xs opacity-50">
                              {new Date(message.timestamp).toLocaleTimeString("ja-JP")}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* チャット入力欄は非表示（閲覧専用のため） */}
                <div className="border-t border-zinc-200 bg-zinc-50 px-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-zinc-600">
                    <span className="text-lg">🔒</span>
                    <p>
                      閲覧専用モードです。AIへの質問はホストを通じて行ってください。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* メインコンテンツエリア終了 */}

        {/* 右ペイン - 用語解説 */}
        <TermExplanationPane
          ref={termPaneRef}
          meetingId={meetingId}
          sessionId={currentSession?.id || null}
          isSessionActive={sessionStatus === "active"}
          transcripts={transcripts}
          industries={industries}
          onTermCardsChange={setTermCards}
        />
      </div>
      {/* flex container 終了 */}
    </>
  );
}
