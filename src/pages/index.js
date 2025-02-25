import { useState, useRef } from "react";

export default function Home() {
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState("");
  const [textResponse, setTextResponse] = useState("");  // GPTからのテキストレスポンス
  const mediaRecorderRef = useRef(null); // 🔹 mediaRecorder を useRef で管理
  const audioChunksRef = useRef([]); // 🔹 音声データを格納
  const audioRef = useRef(null);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    
    // 🔹 Ref に mediaRecorder を保存
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      try {
        console.log("Sending request to Django...");
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("audio", audioBlob, "audio.webm");

        const response = await fetch("http://127.0.0.1:8000/api/transcribe/", {
          method: "POST",
          body: formData,
        });

        console.log("Server Response Status:", response.status);
        if (!response.ok) throw new Error(`Server responded with ${response.status}`);

        const data = await response.json();
        console.log("Response:", data);

        if (!data.audio_url) throw new Error("audio_url is missing in response");

        // テキスト更新
        setTextResponse(data.text);

        // 古い音声を停止してから新しい音声をセット
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }

        // 音声のURLを設定
        const completeAudioURL = `http://127.0.0.1:8000${data.audio_url}`;
        setAudioURL(completeAudioURL);

        // 音声を再生
        audioRef.current = new Audio(completeAudioURL);
        audioRef.current.load();
        audioRef.current.play()
          .then(() => console.log("Audio is playing"))
          .catch((error) => console.error("Audio play error:", error));
        // 🔹 音声 URL とテキストをリセット
        setAudioURL("");

      } catch (error) {
        console.error("Fetch error:", error);
      }
    };

    mediaRecorder.start();
    setRecording(true);
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">音声アシスタント</h1>

      <button
        onClick={recording ? stopRecording : startRecording}
        className={`px-6 py-3 rounded-lg text-white font-semibold transition ${
          recording ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"
        }`}
      >
        {recording ? "録音停止" : "お話しする"}
      </button>

      {textResponse && (
        <div className="mt-6 p-4 bg-white shadow-md rounded-md max-w-lg">
          <p className="text-gray-700 font-semibold">AIの返答:</p>
          <p className="text-gray-900 mt-2">{textResponse}</p>
        </div>
      )}
    </div>
  );
}