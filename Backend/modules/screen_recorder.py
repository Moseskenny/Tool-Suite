import os
import numpy as np
import threading
import time
import tempfile
import cv2
import glob
import subprocess


class ScreenRecorder:
    def __init__(self):
        self.recording = False
        self.paused = False
        self.output_path = None
        self.fps = 30
        self.frames_dir = None
        self.region = None
        self._thread = None
        self.frame_count = 0

    def start_recording(self, region=None, temp_dir=None):
        try:
            if self.recording:
                return {"error": "Recording already in progress"}

            if temp_dir is None:
                temp_dir = os.path.join(
                    tempfile.gettempdir(), "ToolSuite_Data", "recordings"
                )

            if not os.path.exists(temp_dir):
                os.makedirs(temp_dir, exist_ok=True)

            self.frames_dir = os.path.join(temp_dir, f"frames_{int(time.time())}")
            os.makedirs(self.frames_dir, exist_ok=True)

            self.region = region
            self.output_path = os.path.join(
                temp_dir, f"recording_{int(time.time())}.mp4"
            )

            self.frame_count = 0
            self.recording = True
            self.paused = False

            self._thread = threading.Thread(target=self._record_loop, daemon=True)
            self._thread.start()

            return {
                "status": "recording",
                "output_path": self.output_path,
                "message": "Recording started",
            }
        except Exception as e:
            return {"error": f"Failed to start recording: {str(e)}"}

    def _record_loop(self):
        try:
            import mss

            with mss.mss() as sct:
                if self.region:
                    monitor = self.region
                else:
                    monitor = sct.monitors[1]

                frame_duration = 1.0 / self.fps

                while self.recording:
                    if not self.paused:
                        img = sct.grab(monitor)
                        frame = np.array(img)
                        frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)

                        frame_path = os.path.join(
                            self.frames_dir, f"frame_{self.frame_count:06d}.png"
                        )
                        cv2.imwrite(frame_path, frame)
                        self.frame_count += 1

                    time.sleep(frame_duration)
        except Exception as e:
            print(f"Recording error: {e}")
        finally:
            self.recording = False

    def stop_recording(self):
        try:
            if not self.recording:
                return {"error": "No recording in progress"}

            self.recording = False

            if self._thread:
                self._thread.join(timeout=10)

            if self.frames_dir and self.frame_count > 0:
                frames = sorted(glob.glob(os.path.join(self.frames_dir, "*.png")))

                if frames:
                    frames_pattern = os.path.join(self.frames_dir, "frame_%06d.png")

                    try:
                        import imageio_ffmpeg

                        ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
                    except Exception:
                        return {
                            "error": "FFmpeg not found. Please install imageio-ffmpeg."
                        }

                    ffmpeg_cmd = [
                        ffmpeg_path,
                        "-y",
                        "-framerate",
                        str(self.fps),
                        "-i",
                        frames_pattern,
                        "-c:v",
                        "libx264",
                        "-pix_fmt",
                        "yuv420p",
                        "-preset",
                        "fast",
                        "-crf",
                        "23",
                        self.output_path,
                    ]

                    result = subprocess.run(
                        ffmpeg_cmd, capture_output=True, text=True, check=False
                    )

                    if result.returncode != 0:
                        return {"error": f"FFmpeg error: {result.stderr}"}

                    for frame_path in frames:
                        os.remove(frame_path)
                    os.rmdir(self.frames_dir)

            filename = os.path.basename(self.output_path)

            return {
                "status": "stopped",
                "filename": filename,
                "output_path": self.output_path,
                "message": "Recording saved successfully",
            }
        except Exception as e:
            return {"error": f"Failed to stop recording: {str(e)}"}

    def get_status(self):
        return {"recording": self.recording, "paused": self.paused}


_recorder_instance = None


def get_recorder():
    global _recorder_instance
    if _recorder_instance is None:
        _recorder_instance = ScreenRecorder()
    return _recorder_instance


def run_screen_recorder(action, region=None, temp_dir=None):
    recorder = get_recorder()

    if action == "start":
        return recorder.start_recording(region, temp_dir)
    elif action == "stop":
        return recorder.stop_recording()
    elif action == "status":
        return recorder.get_status()
    else:
        return {"error": "Invalid action"}
