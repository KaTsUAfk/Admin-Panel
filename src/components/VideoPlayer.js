// src/components/VideoPlayer.js
import React, { useRef, useEffect, useState } from "react";
import Hls from "hls.js";
import { getHlsBaseUrl } from "../services/api";
import { useCity } from "./CityContext";

const VideoPlayer = () => {
  const videoRef = useRef(null);
  const [error, setError] = useState("");
  const { currentCity } = useCity();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const LIVE_URL = `${getHlsBaseUrl()}/stream.m3u8`;
    console.log("Trying to load HLS stream from:", LIVE_URL);
    console.log("Current city:", currentCity);

    const handleError = (e) => {
      console.error("Video error:", e);
      setError(
        `Не удалось загрузить видеопоток для города ${currentCity}. Проверьте сервер HLS.`
      );
    };

    const handleLoaded = () => {
      console.log("Video loaded successfully");
      setError("");
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: false,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hls.loadSource(LIVE_URL);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, handleLoaded);
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error("HLS Error:", data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error("Network error");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error("Media error");
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });

      video.addEventListener("error", handleError);

      return () => {
        hls.destroy();
        video.removeEventListener("error", handleError);
      };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = LIVE_URL;
      video.addEventListener("loadeddata", handleLoaded);
      video.addEventListener("error", handleError);

      return () => {
        video.removeEventListener("loadeddata", handleLoaded);
        video.removeEventListener("error", handleError);
      };
    } else {
      setError("Ваш браузер не поддерживает HLS видео");
    }
  }, [currentCity]);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1000px",
        margin: "20px auto",
        height: "auto",
      }}
    >
      {error && (
        <div
          style={{
            color: "red",
            textAlign: "center",
            padding: "20px",
            backgroundColor: "#ffe6e6",
            border: "1px solid red",
            borderRadius: "4px",
            marginBottom: "10px",
          }}
        >
          {error}
        </div>
      )}
      <div
        style={{
          textAlign: "center",
          marginBottom: "10px",
          fontWeight: "bold",
          color: "#DAB76F",
        }}
      >
        📍 Текущий город: {currentCity === "kurgan" ? "Курган" : "Екатеринбург"}
      </div>
      <video
        ref={videoRef}
        controls
        autoPlay
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          backgroundColor: "#000",
          display: error ? "none" : "block",
        }}
      />
    </div>
  );
};

export default VideoPlayer;
