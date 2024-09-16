declare module '@cycjimmy/jsmpeg-player' {
  export default class JSMpeg {
    constructor(url: string, options?: JSMpegOptions);

    // Metode
    play(): void;
    pause(): void;
    destroy(): void;
    seek(time: number): void;
    getCurrentTime(): number;

    // Properti
    canvas: HTMLCanvasElement;
    duration: number;
    currentTime: number;
    paused: boolean;
    // Anda dapat menambahkan lebih banyak properti jika diperlukan
  }

  interface JSMpegOptions {
    canvas?: HTMLCanvasElement;
    autoplay?: boolean;
    loop?: boolean;
    controls?: boolean;
    // Tambahkan opsi lainnya jika tersedia
  }
}