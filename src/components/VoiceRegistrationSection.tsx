"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VoiceRecorder } from "./VoiceRecorder";

type VoiceRegistrationSectionProps = {
  participantId: string;
  participantName: string;
  hasVoiceProfile: boolean;
};

export function VoiceRegistrationSection({
  participantId,
  participantName,
  hasVoiceProfile,
}: VoiceRegistrationSectionProps) {
  const [showRecorder, setShowRecorder] = useState(false);
  const router = useRouter();

  const handleUploadSuccess = () => {
    setShowRecorder(false);
    router.refresh(); // ページをリフレッシュして音声登録状態を更新
  };

  return (
    <div className="mt-4 border-t border-zinc-200 pt-4">
      <h5 className="text-sm font-medium text-zinc-700">音声プロファイル</h5>

      {hasVoiceProfile ? (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-zinc-600">
            この参加者の音声は登録済みです
          </p>
          <button
            onClick={() => setShowRecorder(!showRecorder)}
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            {showRecorder ? "キャンセル" : "再登録する"}
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-sm text-zinc-600">
            音声が未登録です。音声を登録すると会議で話者認識が可能になります。
          </p>
          {!showRecorder && (
            <button
              onClick={() => setShowRecorder(true)}
              className="mt-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              音声を登録
            </button>
          )}
        </div>
      )}

      {showRecorder && (
        <div className="mt-4">
          <VoiceRecorder
            participantId={participantId}
            participantName={participantName}
            onUploadSuccess={handleUploadSuccess}
          />
        </div>
      )}
    </div>
  );
}
