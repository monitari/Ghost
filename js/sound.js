export function playSound(source, duration = 1000, fadeOutDuration = 500, startTime = 0, volume = 1.0) {
  const audio = new Audio(source);
  audio.currentTime = startTime;
  audio.volume = volume;
  audio.play();

  setTimeout(() => {
    const fadeOutInterval = 50;
    const fadeOutStep = audio.volume / (fadeOutDuration / fadeOutInterval);

    const fadeOut = setInterval(() => {
      if (audio.volume > fadeOutStep) {
        audio.volume -= fadeOutStep;
      } else {
        audio.volume = 0;
        audio.pause();
        clearInterval(fadeOut);
      }
    }, fadeOutInterval);
  }, duration);
}
